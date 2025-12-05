/**
 * Call routes module for HTTP endpoints
 * @module routes/callRoutes
 */

import { Router, Request, Response } from 'express';
import { getActiveCallsCount, getTotalUsersInCalls, getCallRoomInfo } from '../config/socket';
import { DEFAULT_ICE_SERVERS } from '../types';

/** Express router instance for call-related routes */
const router = Router();

/**
 * Health check endpoint for the call service
 * @route GET /api/call/health
 * @access Public
 * @returns {Object} Health status with service information
 * @example
 * // Response
 * {
 *   "success": true,
 *   "service": "voice-call-server",
 *   "status": "ok",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "environment": "development"
 * }
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: 'voice-call-server',
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Get server statistics including active calls and total users
 * @route GET /api/call/stats
 * @access Public
 * @returns {Object} Server statistics
 * @example
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "activeCalls": 5,
 *     "totalUsersInCalls": 23,
 *     "maxParticipantsPerCall": 10,
 *     "minParticipantsPerCall": 2
 *   }
 * }
 */
router.get('/stats', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      activeCalls: getActiveCallsCount(),
      totalUsersInCalls: getTotalUsersInCalls(),
      maxParticipantsPerCall: parseInt(process.env.MAX_PARTICIPANTS || '10', 10),
      minParticipantsPerCall: parseInt(process.env.MIN_PARTICIPANTS || '2', 10),
    },
  });
});

/**
 * Get information about a specific call room
 * @route GET /api/call/room/:meetingId
 * @access Public
 * @param {string} meetingId - The unique identifier of the meeting/call room
 * @returns {Object} Room information including participants
 * @example
 * // Response (success)
 * {
 *   "success": true,
 *   "data": {
 *     "meetingId": "abc123",
 *     "participants": 3,
 *     "users": [
 *       { "userId": "user1", "username": "John", "isMuted": false },
 *       { "userId": "user2", "username": "Jane", "isMuted": true }
 *     ]
 *   }
 * }
 * // Response (not found)
 * {
 *   "success": false,
 *   "message": "Call room not found or no active call"
 * }
 */
router.get('/room/:meetingId', (req: Request, res: Response) => {
  const { meetingId } = req.params;

  if (!meetingId) {
    res.status(400).json({
      success: false,
      message: 'Meeting ID is required',
    });
    return;
  }

  const roomInfo = getCallRoomInfo(meetingId);

  if (!roomInfo) {
    res.status(404).json({
      success: false,
      message: 'Call room not found or no active call',
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: roomInfo,
  });
});

/**
 * Get ICE servers configuration for WebRTC connections
 * @route GET /api/call/ice-servers
 * @access Public
 * @returns {Object} Array of ICE server configurations (STUN/TURN)
 * @description Returns the list of STUN servers used for NAT traversal in WebRTC connections.
 * These servers help peers discover their public IP addresses.
 * @example
 * // Response
 * {
 *   "success": true,
 *   "data": {
 *     "iceServers": [
 *       { "urls": "stun:stun.l.google.com:19302" },
 *       { "urls": "stun:stun1.l.google.com:19302" }
 *     ]
 *   }
 * }
 */
router.get('/ice-servers', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      iceServers: DEFAULT_ICE_SERVERS,
    },
  });
});

export default router;
