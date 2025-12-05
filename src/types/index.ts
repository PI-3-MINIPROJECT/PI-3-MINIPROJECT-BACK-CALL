/**
 * Type definitions for the Voice Call Server
 * @module types
 * @description Contains all TypeScript interfaces, types, and enums used throughout the voice call server.
 * Includes definitions for participants, payloads, notifications, and socket events.
 */

/**
 * Represents a participant in a voice call room
 * @interface CallParticipant
 * @description Contains all information about a user connected to a voice call,
 * including their socket connection, peer ID for WebRTC, and mute status.
 */
export interface CallParticipant {
  /** Unique Socket.IO socket identifier */
  socketId: string;
  /** Unique user identifier from the authentication system */
  userId: string;
  /** Meeting/room identifier that this participant belongs to */
  meetingId: string;
  /** PeerJS peer identifier for establishing WebRTC connections */
  peerId: string;
  /** Display name of the participant */
  username: string;
  /** Whether the participant's microphone is currently muted */
  isMuted: boolean;
  /** ISO 8601 timestamp of when the participant joined the call */
  joinedAt: string;
}

/**
 * Payload sent when a client joins a voice call
 * @interface JoinCallPayload
 * @description Contains the necessary information for a client to join an existing
 * voice call room or create a new one if it doesn't exist.
 */
export interface JoinCallPayload {
  /** Meeting/room identifier to join */
  meetingId: string;
  /** Unique user identifier */
  userId: string;
  /** PeerJS peer identifier for WebRTC connections */
  peerId: string;
  /** Display name of the user joining */
  username: string;
}

/**
 * Payload sent when a client leaves a voice call
 * @interface LeaveCallPayload
 * @description Contains the minimum information needed to identify and remove
 * a participant from a voice call room.
 */
export interface LeaveCallPayload {
  /** Meeting/room identifier to leave */
  meetingId: string;
  /** Unique user identifier of the leaving participant */
  userId: string;
}

/**
 * Payload for WebRTC signaling messages
 * @interface SignalPayload
 * @description Used to exchange WebRTC signaling data (SDP offers, answers, and ICE candidates)
 * between peers through the server. The server acts as a relay for these signals.
 */
export interface SignalPayload {
  /** Meeting/room identifier where the signal is being sent */
  meetingId: string;
  /** User identifier of the signal sender */
  fromUserId: string;
  /** User identifier of the intended signal recipient */
  toUserId: string;
  /** PeerJS peer identifier of the sender */
  fromPeerId: string;
  /** PeerJS peer identifier of the recipient */
  toPeerId: string;
  /** WebRTC signal data (SDP offer, SDP answer, or ICE candidate) */
  signal: unknown;
  /** Type of WebRTC signal being sent */
  signalType: 'offer' | 'answer' | 'ice-candidate';
}

/**
 * Payload for mute and unmute actions
 * @interface MutePayload
 * @description Sent when a user mutes or unmutes their microphone.
 * The server broadcasts this status change to all other participants.
 */
export interface MutePayload {
  /** Meeting/room identifier where the mute action occurred */
  meetingId: string;
  /** User identifier of the participant changing mute status */
  userId: string;
}

/**
 * Response containing the list of peers in a call
 * @interface PeersListResponse
 * @description Sent to a newly joined participant containing information about
 * all other participants already in the call. Used to establish initial connections.
 */
export interface PeersListResponse {
  /** Meeting/room identifier */
  meetingId: string;
  /** Array of participant information */
  participants: Array<{
    /** User identifier */
    userId: string;
    /** PeerJS peer identifier for WebRTC connection */
    peerId: string;
    /** Display name */
    username: string;
    /** Current mute status */
    isMuted: boolean;
    /** ISO 8601 timestamp of when they joined */
    joinedAt: string;
  }>;
  /** Total number of participants in the list */
  count: number;
}

/**
 * Notification broadcast when a new peer joins the call
 * @interface PeerJoinedNotification
 * @description Sent to all existing participants when a new user joins the voice call.
 * Recipients should initiate a WebRTC connection with the new peer.
 */
export interface PeerJoinedNotification {
  /** User identifier of the new participant */
  userId: string;
  /** PeerJS peer identifier for establishing WebRTC connection */
  peerId: string;
  /** Display name of the new participant */
  username: string;
  /** ISO 8601 timestamp of when they joined */
  timestamp: string;
}

/**
 * Notification broadcast when a peer leaves the call
 * @interface PeerLeftNotification
 * @description Sent to all remaining participants when a user leaves the voice call.
 * Recipients should close their WebRTC connection with this peer.
 */
export interface PeerLeftNotification {
  /** User identifier of the leaving participant */
  userId: string;
  /** PeerJS peer identifier of the leaving participant */
  peerId: string;
  /** Display name of the leaving participant */
  username: string;
  /** ISO 8601 timestamp of when they left */
  timestamp: string;
}

/**
 * Notification broadcast when a participant's mute status changes
 * @interface MuteStatusNotification
 * @description Sent to all participants in a call when someone mutes or unmutes.
 * Used to update UI indicators showing who is speaking or muted.
 */
export interface MuteStatusNotification {
  /** User identifier of the participant who changed status */
  userId: string;
  /** Display name of the participant */
  username: string;
  /** New mute status (true = muted, false = unmuted) */
  isMuted: boolean;
  /** ISO 8601 timestamp of the status change */
  timestamp: string;
}

/**
 * Error response sent to clients
 * @interface CallError
 * @description Standard error format sent when an operation fails.
 * Includes a human-readable message and optional error code for programmatic handling.
 */
export interface CallError {
  /** Human-readable error message */
  message: string;
  /** Optional error code for programmatic error handling */
  code?: string;
}

/**
 * Socket.IO event names for voice call operations
 * @enum {string} CallEvents
 * @description Enumeration of all socket event names used in the voice call system.
 * Using an enum ensures consistency between client and server implementations.
 */
export enum CallEvents {
  /** Socket.IO built-in connection event */
  CONNECTION = 'connection',
  /** Socket.IO built-in disconnection event */
  DISCONNECT = 'disconnect',
  
  /** Client requests to join a voice call room */
  JOIN = 'call:join',
  /** Client requests to leave a voice call room */
  LEAVE = 'call:leave',
  
  /** WebRTC signaling message (offer, answer, or ICE candidate) */
  SIGNAL = 'call:signal',
  
  /** Client mutes their microphone */
  MUTE = 'call:mute',
  /** Client unmutes their microphone */
  UNMUTE = 'call:unmute',
  
  /** Server notifies clients that a new peer has joined */
  PEER_JOINED = 'call:peer-joined',
  /** Server notifies clients that a peer has left */
  PEER_LEFT = 'call:peer-left',
  /** Server sends list of current peers to a newly joined client */
  PEERS_LIST = 'call:peers-list',
  /** Server broadcasts a participant's mute status change */
  MUTE_STATUS = 'call:mute-status',
  
  /** Server sends an error message to a client */
  ERROR = 'call:error',
}

/**
 * ICE (Interactive Connectivity Establishment) server configuration
 * @interface IceServer
 * @description Configuration for STUN/TURN servers used in WebRTC connections.
 * STUN servers help clients discover their public IP addresses for NAT traversal.
 */
export interface IceServer {
  /** STUN/TURN server URL(s) in the format "stun:hostname:port" or "turn:hostname:port" */
  urls: string | string[];
  /** Username for TURN server authentication (optional for STUN) */
  username?: string;
  /** Credential/password for TURN server authentication (optional for STUN) */
  credential?: string;
}

/**
 * Default ICE servers configuration using Google's public STUN servers
 * @constant {IceServer[]}
 * @description Array of public Google STUN servers for NAT traversal.
 * These servers are free to use and have high availability.
 * STUN servers help peers discover their public IP addresses when behind NAT.
 */
export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];
