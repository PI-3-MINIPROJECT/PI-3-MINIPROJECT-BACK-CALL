/**
 * Socket.IO configuration and event handlers for voice calls
 * @module config/socket
 * @description Handles all Socket.IO events for real-time voice communication,
 * including room management, WebRTC signaling, and participant state management.
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import {
  CallEvents,
  CallParticipant,
  JoinCallPayload,
  LeaveCallPayload,
  SignalPayload,
  MutePayload,
  VideoPayload,
  getIceServers,
} from '../types';
import { logger } from '../utils/logger';

/**
 * In-memory storage for active call rooms with their participants
 * @type {Map<string, Map<string, CallParticipant>>}
 * @description Key: meetingId, Value: Map of participants where key is userId and value is CallParticipant
 */
const callRooms = new Map<string, Map<string, CallParticipant>>();

/**
 * Map socket IDs to user info for quick lookup on disconnect
 * @type {Map<string, { meetingId: string; userId: string }>}
 * @description Key: socketId, Value: { meetingId, userId }
 */
const socketToUser = new Map<string, { meetingId: string; userId: string }>();

/**
 * Maximum number of participants allowed per call room
 * @constant {number}
 * @default 10
 */
const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '10', 10);

/**
 * Initialize Socket.IO server for voice calls
 * @param {HTTPServer} httpServer - HTTP server instance to attach Socket.IO to
 * @returns {Server} Configured Socket.IO server instance with all event handlers
 * @description Sets up Socket.IO server with CORS configuration and registers all event handlers
 * for voice call operations including join, leave, signaling, and mute/unmute events.
 * @example
 * const httpServer = createServer(app);
 * const io = initializeSocketIO(httpServer);
 */
export const initializeSocketIO = (httpServer: HTTPServer): Server => {
  const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = corsOriginEnv === '*' 
    ? '*' 
    : corsOriginEnv.split(',').map(origin => origin.trim());

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: allowedOrigins !== '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  /**
   * Handle socket connection
   * @param {Socket} socket - Socket instance representing a client connection
   * @description Sets up event listeners for all voice call operations when a client connects.
   * Automatically sends ICE server configuration to the client upon connection.
   */
  io.on(CallEvents.CONNECTION, (socket: Socket) => {
    logger.socket('connection', `New connection: ${socket.id}`);

    // Send ICE servers configuration to client (includes ExpressTURN if configured)
    socket.emit('call:ice-servers', getIceServers());

    /**
     * Handle user joining a voice call
     * @param {JoinCallPayload} payload - Payload containing meetingId, userId, peerId, and username
     * @description Validates the payload, creates or joins a call room, and notifies other participants.
     * Sends the list of existing peers to the newly joined participant.
     * @fires CallEvents#PEERS_LIST - Emitted to the joining participant with list of existing peers
     * @fires CallEvents#PEER_JOINED - Emitted to all other participants when a new peer joins
     * @fires CallEvents#ERROR - Emitted if validation fails or room is full
     */
    socket.on(CallEvents.JOIN, (payload: JoinCallPayload) => {
      try {
        const { meetingId, userId, peerId, username } = payload;

        // Validate payload
        if (!meetingId || !userId || !peerId) {
          socket.emit(CallEvents.ERROR, {
            message: 'Meeting ID, User ID, and Peer ID are required',
            code: 'INVALID_PAYLOAD',
          });
          return;
        }

        // Get or create the call room
        let room = callRooms.get(meetingId);
        if (!room) {
          room = new Map<string, CallParticipant>();
          callRooms.set(meetingId, room);
        }

        // Check if room is full
        if (room.size >= MAX_PARTICIPANTS) {
          socket.emit(CallEvents.ERROR, {
            message: `Call is full (maximum ${MAX_PARTICIPANTS} participants)`,
            code: 'ROOM_FULL',
          });
          return;
        }

        // Check if user is already in the call (reconnection)
        const existingParticipant = room.get(userId);
        if (existingParticipant) {
          // Update socket ID and peer ID (reconnection)
          existingParticipant.socketId = socket.id;
          existingParticipant.peerId = peerId;
          logger.call('reconnect', `User ${username} reconnected to call ${meetingId}`);
        } else {
          // Add new participant
          const participant: CallParticipant = {
            socketId: socket.id,
            userId,
            meetingId,
            peerId,
            username: username || 'Anonymous',
            isMuted: true, // Start muted by default
            isVideoOn: false, // Start with camera off by default
            joinedAt: new Date().toISOString(),
          };
          room.set(userId, participant);
          logger.call('join', `User ${username} joined call ${meetingId}`);
        }

        // Map socket to user for disconnect handling
        socketToUser.set(socket.id, { meetingId, userId });

        // Join the socket room
        socket.join(meetingId);

        // Get list of other participants (excluding self)
        const otherParticipants = Array.from(room.values())
          .filter(p => p.userId !== userId)
          .map(p => ({
            userId: p.userId,
            peerId: p.peerId,
            username: p.username,
            isMuted: p.isMuted,
            isVideoOn: p.isVideoOn,
            joinedAt: p.joinedAt,
          }));

        // Send list of existing peers to the new participant
        socket.emit(CallEvents.PEERS_LIST, {
          meetingId,
          participants: otherParticipants,
          count: otherParticipants.length,
        });

        // Notify other participants about the new peer
        socket.to(meetingId).emit(CallEvents.PEER_JOINED, {
          userId,
          peerId,
          username: username || 'Anonymous',
          timestamp: new Date().toISOString(),
        });

        logger.call('join', `Call ${meetingId} now has ${room.size} participants`);

      } catch (error) {
        logger.error('Error joining call', error);
        socket.emit(CallEvents.ERROR, {
          message: 'Failed to join call',
          code: 'JOIN_ERROR',
        });
      }
    });

    /**
     * Handle WebRTC signaling (offer, answer, ICE candidates)
     * @param {SignalPayload} payload - Payload containing signaling data and target user information
     * @description Forwards WebRTC signaling messages between peers. The server acts as a relay
     * for SDP offers, answers, and ICE candidates to establish peer-to-peer connections.
     * @fires CallEvents#SIGNAL - Emitted to the target peer with the signaling data
     * @fires CallEvents#ERROR - Emitted if room, target user, or payload is invalid
     */
    socket.on(CallEvents.SIGNAL, (payload: SignalPayload) => {
      try {
        const { meetingId, toUserId, toPeerId, signal, signalType } = payload;

        if (!meetingId || !toUserId || !signal) {
          socket.emit(CallEvents.ERROR, {
            message: 'Invalid signal payload',
            code: 'INVALID_SIGNAL',
          });
          return;
        }

        const room = callRooms.get(meetingId);
        if (!room) {
          socket.emit(CallEvents.ERROR, {
            message: 'Call room not found',
            code: 'ROOM_NOT_FOUND',
          });
          return;
        }

        // Find the target participant
        const targetParticipant = room.get(toUserId);
        if (!targetParticipant) {
          socket.emit(CallEvents.ERROR, {
            message: 'Target user not found in call',
            code: 'USER_NOT_FOUND',
          });
          return;
        }

        // Get sender info
        const userInfo = socketToUser.get(socket.id);
        const senderParticipant = userInfo ? room.get(userInfo.userId) : null;

        // Forward the signal to the target peer
        io.to(targetParticipant.socketId).emit(CallEvents.SIGNAL, {
          meetingId,
          fromUserId: userInfo?.userId,
          toUserId,
          fromPeerId: senderParticipant?.peerId,
          toPeerId,
          signal,
          signalType,
        });

        logger.socket('signal', `Signal ${signalType} from ${userInfo?.userId} to ${toUserId}`);

      } catch (error) {
        logger.error('Error handling signal', error);
        socket.emit(CallEvents.ERROR, {
          message: 'Failed to send signal',
          code: 'SIGNAL_ERROR',
        });
      }
    });

    /**
     * Handle user muting their microphone
     * @param {MutePayload} payload - Payload containing meetingId and userId
     * @description Updates the participant's mute status and broadcasts the change to all
     * participants in the call room.
     * @fires CallEvents#MUTE_STATUS - Emitted to all participants in the room with updated mute status
     */
    socket.on(CallEvents.MUTE, (payload: MutePayload) => {
      try {
        const { meetingId, userId } = payload;

        if (!meetingId || !userId) {
          return;
        }

        const room = callRooms.get(meetingId);
        if (!room) return;

        const participant = room.get(userId);
        if (!participant) return;

        // Update mute status
        participant.isMuted = true;

        // Broadcast mute status to all participants in the room
        io.to(meetingId).emit(CallEvents.MUTE_STATUS, {
          userId,
          username: participant.username,
          isMuted: true,
          timestamp: new Date().toISOString(),
        });

        logger.call('mute', `User ${participant.username} muted in call ${meetingId}`);

      } catch (error) {
        logger.error('Error handling mute', error);
      }
    });

    /**
     * Handle user unmuting their microphone
     * @param {MutePayload} payload - Payload containing meetingId and userId
     * @description Updates the participant's mute status and broadcasts the change to all
     * participants in the call room.
     * @fires CallEvents#MUTE_STATUS - Emitted to all participants in the room with updated mute status
     */
    socket.on(CallEvents.UNMUTE, (payload: MutePayload) => {
      try {
        const { meetingId, userId } = payload;

        if (!meetingId || !userId) {
          return;
        }

        const room = callRooms.get(meetingId);
        if (!room) return;

        const participant = room.get(userId);
        if (!participant) return;

        // Update mute status
        participant.isMuted = false;

        // Broadcast unmute status to all participants in the room
        io.to(meetingId).emit(CallEvents.MUTE_STATUS, {
          userId,
          username: participant.username,
          isMuted: false,
          timestamp: new Date().toISOString(),
        });

        logger.call('unmute', `User ${participant.username} unmuted in call ${meetingId}`);

      } catch (error) {
        logger.error('Error handling unmute', error);
      }
    });

    /**
     * Handle user turning on their camera
     * @param {VideoPayload} payload - Payload containing meetingId and userId
     * @description Updates the participant's video status and broadcasts the change to all
     * participants in the call room.
     * @fires CallEvents#VIDEO_STATUS - Emitted to all participants in the room with updated video status
     */
    socket.on(CallEvents.VIDEO_ON, (payload: VideoPayload) => {
      try {
        const { meetingId, userId } = payload;

        if (!meetingId || !userId) {
          return;
        }

        const room = callRooms.get(meetingId);
        if (!room) return;

        const participant = room.get(userId);
        if (!participant) return;

        // Update video status
        participant.isVideoOn = true;

        // Broadcast video status to all participants in the room
        io.to(meetingId).emit(CallEvents.VIDEO_STATUS, {
          userId,
          username: participant.username,
          isVideoOn: true,
          timestamp: new Date().toISOString(),
        });

        logger.call('video-on', `User ${participant.username} turned on camera in call ${meetingId}`);

      } catch (error) {
        logger.error('Error handling video on', error);
      }
    });

    /**
     * Handle user turning off their camera
     * @param {VideoPayload} payload - Payload containing meetingId and userId
     * @description Updates the participant's video status and broadcasts the change to all
     * participants in the call room.
     * @fires CallEvents#VIDEO_STATUS - Emitted to all participants in the room with updated video status
     */
    socket.on(CallEvents.VIDEO_OFF, (payload: VideoPayload) => {
      try {
        const { meetingId, userId } = payload;

        if (!meetingId || !userId) {
          return;
        }

        const room = callRooms.get(meetingId);
        if (!room) return;

        const participant = room.get(userId);
        if (!participant) return;

        // Update video status
        participant.isVideoOn = false;

        // Broadcast video status to all participants in the room
        io.to(meetingId).emit(CallEvents.VIDEO_STATUS, {
          userId,
          username: participant.username,
          isVideoOn: false,
          timestamp: new Date().toISOString(),
        });

        logger.call('video-off', `User ${participant.username} turned off camera in call ${meetingId}`);

      } catch (error) {
        logger.error('Error handling video off', error);
      }
    });

    /**
     * Handle user leaving a call
     * @param {LeaveCallPayload} payload - Payload containing meetingId and userId
     * @description Removes the participant from the call room and notifies other participants.
     * Cleans up empty rooms automatically.
     * @fires CallEvents#PEER_LEFT - Emitted to all remaining participants when a user leaves
     */
    socket.on(CallEvents.LEAVE, (payload: LeaveCallPayload) => {
      handleUserLeave(socket, io, payload.meetingId, payload.userId);
    });

    /**
     * Handle socket disconnection
     * @description Automatically handles user leave when socket disconnects unexpectedly.
     * Uses the socket-to-user mapping to identify which user left and clean up their resources.
     */
    socket.on(CallEvents.DISCONNECT, () => {
      const userInfo = socketToUser.get(socket.id);
      
      if (userInfo) {
        handleUserLeave(socket, io, userInfo.meetingId, userInfo.userId);
      }

      logger.socket('disconnect', `Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Handle user leaving a call (either explicitly or on disconnect)
 * @param {Socket} socket - Socket instance of the leaving user
 * @param {Server} io - Socket.IO server instance for broadcasting events
 * @param {string} meetingId - Meeting/room identifier
 * @param {string} userId - User identifier of the leaving participant
 * @returns {void}
 * @description Removes the participant from the call room, cleans up socket mappings,
 * and notifies all remaining participants. Automatically deletes empty rooms to free memory.
 * @fires CallEvents#PEER_LEFT - Emitted to all remaining participants in the room
 * @private
 */
function handleUserLeave(
  socket: Socket,
  io: Server,
  meetingId: string,
  userId: string
): void {
  try {
    if (!meetingId || !userId) return;

    const room = callRooms.get(meetingId);
    if (!room) return;

    const participant = room.get(userId);
    if (!participant) return;

    // Remove participant from room
    room.delete(userId);

    // Remove socket mapping
    socketToUser.delete(socket.id);

    // Leave the socket room
    socket.leave(meetingId);

    // Notify other participants
    io.to(meetingId).emit(CallEvents.PEER_LEFT, {
      userId,
      peerId: participant.peerId,
      username: participant.username,
      timestamp: new Date().toISOString(),
    });

    logger.call('leave', `User ${participant.username} left call ${meetingId}`);

    // Clean up empty rooms
    if (room.size === 0) {
      callRooms.delete(meetingId);
      logger.call('cleanup', `Call room ${meetingId} deleted (empty)`);
    } else {
      logger.call('leave', `Call ${meetingId} now has ${room.size} participants`);
    }

  } catch (error) {
    logger.error('Error handling user leave', error);
  }
}

/**
 * Get the number of active call rooms
 * @returns {number} Total number of active call rooms currently in memory
 * @description Returns the count of distinct meeting rooms that have at least one participant.
 * @example
 * const activeCalls = getActiveCallsCount();
 * // Returns: 5 (if there are 5 active call rooms)
 */
export const getActiveCallsCount = (): number => {
  return callRooms.size;
};

/**
 * Get the total number of users across all active call rooms
 * @returns {number} Total number of participants in all call rooms
 * @description Iterates through all active call rooms and sums up the total number of participants.
 * Useful for server statistics and monitoring.
 * @example
 * const totalUsers = getTotalUsersInCalls();
 * // Returns: 23 (if there are 23 total participants across all rooms)
 */
export const getTotalUsersInCalls = (): number => {
  let total = 0;
  for (const room of callRooms.values()) {
    total += room.size;
  }
  return total;
};

/**
 * Get call room information including participants list
 * @param {string} meetingId - Meeting/room identifier
 * @returns {Object | null} Room information object with meetingId, participant count, and user list, or null if room doesn't exist
 * @description Retrieves detailed information about a specific call room, including all participants
 * and their current mute and video status. Returns null if the room doesn't exist or has no active participants.
 * @example
 * const roomInfo = getCallRoomInfo('meeting-123');
 * // Returns: { meetingId: 'meeting-123', participants: 3, users: [...] }
 */
export const getCallRoomInfo = (meetingId: string): {
  meetingId: string;
  participants: number;
  users: Array<{ userId: string; username: string; isMuted: boolean; isVideoOn: boolean }>;
} | null => {
  const room = callRooms.get(meetingId);
  if (!room) return null;

  return {
    meetingId,
    participants: room.size,
    users: Array.from(room.values()).map(p => ({
      userId: p.userId,
      username: p.username,
      isMuted: p.isMuted,
      isVideoOn: p.isVideoOn,
    })),
  };
};

