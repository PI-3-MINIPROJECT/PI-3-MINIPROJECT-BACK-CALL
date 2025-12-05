/**
 * Error handling middleware module
 * @module middlewares/errorHandler
 * @description Provides centralized error handling for Express application
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom application error interface extending the native Error
 * @interface AppError
 * @extends {Error}
 */
interface AppError extends Error {
  /** HTTP status code for the error response */
  statusCode?: number;
  /** Error status type ('fail' for client errors, 'error' for server errors) */
  status?: string;
}

/**
 * Creates a custom error object with HTTP status code
 * @param {string} message - Error message to display
 * @param {number} statusCode - HTTP status code (e.g., 400, 404, 500)
 * @returns {AppError} Custom error object with status code
 * @example
 * // Create a 404 Not Found error
 * const error = createError('Resource not found', 404);
 * 
 * // Create a 400 Bad Request error
 * const error = createError('Invalid input', 400);
 */
export const createError = (message: string, statusCode: number): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode >= 500 ? 'error' : 'fail';
  return error;
};

/**
 * Global error handler middleware for Express
 * @param {AppError} err - Error object to handle
 * @param {Request} _req - Express request object (unused)
 * @param {Response} res - Express response object
 * @param {NextFunction} _next - Express next function (unused)
 * @returns {void}
 * @description Catches all errors thrown in the application and sends a formatted JSON response.
 * In development mode, includes the stack trace for debugging.
 * @example
 * // Usage in Express app
 * app.use(errorHandler);
 */
export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`${statusCode} - ${message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Not found handler middleware for undefined routes
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} _next - Express next function (unused)
 * @returns {void}
 * @description Handles requests to undefined routes and returns a 404 response.
 * Should be placed after all other route definitions.
 * @example
 * // Usage in Express app (after all routes)
 * app.use(notFoundHandler);
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
