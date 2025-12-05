/**
 * Voice Call Server - Main Entry Point
 * @module server
 * @description Real-time voice call server using Socket.IO for WebRTC signaling.
 * This server handles voice call coordination, peer discovery, and mute/unmute states
 * for the video conference platform.
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

import express, { Application } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { initializeSocketIO } from './config/socket';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import callRoutes from './routes/callRoutes';
import { logger } from './utils/logger';

/**
 * Main application class for the Voice Call Server
 * @class App
 * @description Encapsulates the Express application, HTTP server, and Socket.IO instance.
 * Handles initialization of middlewares, routes, and real-time communication.
 */
class App {
  /** Express application instance */
  public app: Application;
  
  /** HTTP server instance */
  public server: ReturnType<typeof createServer>;
  
  /** Socket.IO server instance for real-time communication */
  public io: Server | null = null;
  
  /** Server port number */
  private readonly PORT: number;

  /**
   * Creates a new App instance and initializes all components
   * @constructor
   */
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.PORT = parseInt(process.env.PORT || '5000', 10);
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSocketIO();
    this.initializeErrorHandling();
  }

  /**
   * Initializes Express middlewares for security, parsing, and logging
   * @private
   * @returns {void}
   * @description Sets up:
   * - Helmet for security headers
   * - CORS for cross-origin requests
   * - Body parsers for JSON and URL-encoded data
   * - Morgan for HTTP request logging
   */
  private initializeMiddlewares(): void {
    // Security middleware - sets various HTTP headers
    this.app.use(helmet());
    
    // CORS configuration - supports multiple origins separated by comma
    const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const allowedOrigins = corsOriginEnv === '*' 
      ? '*' 
      : corsOriginEnv.split(',').map(origin => origin.trim());
    
    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow any origin if configured with '*'
          if (allowedOrigins === '*') {
            return callback(null, true);
          }
          
          // Allow requests without origin (Postman, mobile apps, same origin)
          if (!origin) {
            return callback(null, true);
          }
          
          // Check if origin is in the allowed list
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
          }
        },
        credentials: allowedOrigins === '*' ? false : true,
      })
    );

    // Body parser middlewares
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // HTTP request logging - 'dev' format for development, 'combined' for production
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }
  }

  /**
   * Initializes API routes and endpoints
   * @private
   * @returns {void}
   * @description Sets up:
   * - Root endpoint with service information
   * - Health check endpoint
   * - Call-related API routes
   */
  private initializeRoutes(): void {
    // Health check endpoint at root level
    this.app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        service: 'voice-call-server',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // Mount call-related routes
    this.app.use('/api/call', callRoutes);

    // Root endpoint with service information and available endpoints
    this.app.get('/', (_req, res) => {
      res.status(200).json({
        service: 'PI-3 Miniproject Voice Call Server',
        version: '1.0.0',
        description: 'Real-time voice call server with Socket.IO and WebRTC/PeerJS',
        endpoints: {
          health: '/health',
          stats: '/api/call/stats',
          iceServers: '/api/call/ice-servers',
          roomInfo: '/api/call/room/:meetingId',
        },
        socketEvents: {
          join: 'call:join',
          leave: 'call:leave',
          signal: 'call:signal',
          mute: 'call:mute',
          unmute: 'call:unmute',
          peerJoined: 'call:peer-joined',
          peerLeft: 'call:peer-left',
          peersList: 'call:peers-list',
          muteStatus: 'call:mute-status',
          iceServers: 'call:ice-servers',
          error: 'call:error',
        },
      });
    });
  }

  /**
   * Initializes Socket.IO server for real-time voice communication
   * @private
   * @returns {void}
   * @description Sets up Socket.IO with event handlers for:
   * - Joining/leaving voice calls
   * - WebRTC signaling (offer, answer, ICE candidates)
   * - Mute/unmute status broadcasting
   */
  private initializeSocketIO(): void {
    this.io = initializeSocketIO(this.server);
    logger.success('Socket.IO initialized for voice calls');
  }

  /**
   * Initializes error handling middlewares
   * @private
   * @returns {void}
   * @description Sets up:
   * - 404 Not Found handler for undefined routes
   * - Global error handler for all errors
   */
  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  /**
   * Starts the HTTP server and begins listening for connections
   * @public
   * @returns {void}
   * @description Starts the server on the configured port and logs startup information
   */
  public listen(): void {
    this.server.listen(this.PORT, () => {
      logger.success(`Voice Call Server running on port ${this.PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${this.PORT}/health`);
      logger.info('Socket.IO ready for voice connections');
    });
  }
}

/**
 * Global handler for unhandled promise rejections
 * @param {unknown} reason - The rejection reason
 * @param {Promise<unknown>} promise - The rejected promise
 */
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection', { promise, reason });
});

/**
 * Global handler for uncaught exceptions
 * @param {Error} error - The uncaught error
 * @description Logs the error and exits the process with code 1
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Create and start the application instance
const app = new App();
app.listen();

// Export for testing purposes
export default app;
