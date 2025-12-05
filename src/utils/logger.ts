/**
 * Logger utility module with colored console output
 * @module utils/logger
 * @description Provides logging functions with different severity levels and colored output for terminal
 */

/**
 * ANSI color codes for terminal output formatting
 * @constant {Object}
 */
const colors = {
  /** Reset all formatting */
  reset: '\x1b[0m',
  /** Bold/bright text */
  bright: '\x1b[1m',
  /** Red color for errors */
  red: '\x1b[31m',
  /** Green color for success messages */
  green: '\x1b[32m',
  /** Yellow color for warnings */
  yellow: '\x1b[33m',
  /** Blue color for info messages */
  blue: '\x1b[34m',
  /** Magenta color for debug messages */
  magenta: '\x1b[35m',
  /** Cyan color for timestamps and socket events */
  cyan: '\x1b[36m',
} as const;

/**
 * Gets the current timestamp in ISO 8601 format
 * @returns {string} Current timestamp string
 * @example
 * // Returns: "2024-01-01T12:00:00.000Z"
 * getTimestamp();
 */
const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Logger object providing methods for different log levels
 * @namespace logger
 */
export const logger = {
  /**
   * Logs an informational message
   * @param {string} message - The message to log
   * @param {unknown} [data] - Optional additional data to log
   * @returns {void}
   * @example
   * logger.info('Server started');
   * logger.info('User connected', { oderId: '123' });
   */
  info: (message: string, data?: unknown): void => {
    console.log(
      `${colors.blue}[INFO]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - ${message}`,
      data !== undefined ? data : ''
    );
  },

  /**
   * Logs a success message with green color and checkmark
   * @param {string} message - The success message to log
   * @param {unknown} [data] - Optional additional data to log
   * @returns {void}
   * @example
   * logger.success('Connection established');
   */
  success: (message: string, data?: unknown): void => {
    console.log(
      `${colors.green}[SUCCESS]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - ✅ ${message}`,
      data !== undefined ? data : ''
    );
  },

  /**
   * Logs a warning message with yellow color
   * @param {string} message - The warning message to log
   * @param {unknown} [data] - Optional additional data to log
   * @returns {void}
   * @example
   * logger.warn('Connection timeout approaching');
   */
  warn: (message: string, data?: unknown): void => {
    console.warn(
      `${colors.yellow}[WARN]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - ⚠️ ${message}`,
      data !== undefined ? data : ''
    );
  },

  /**
   * Logs an error message with red color
   * @param {string} message - The error message to log
   * @param {unknown} [error] - Optional error object or additional data
   * @returns {void}
   * @example
   * logger.error('Failed to connect', new Error('Connection refused'));
   */
  error: (message: string, error?: unknown): void => {
    console.error(
      `${colors.red}[ERROR]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - ❌ ${message}`,
      error !== undefined ? error : ''
    );
  },

  /**
   * Logs a debug message (only in non-production environments)
   * @param {string} message - The debug message to log
   * @param {unknown} [data] - Optional additional data to log
   * @returns {void}
   * @example
   * logger.debug('Variable state', { count: 5 });
   */
  debug: (message: string, data?: unknown): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `${colors.magenta}[DEBUG]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - 🔍 ${message}`,
        data !== undefined ? data : ''
      );
    }
  },

  /**
   * Logs a Socket.IO related event
   * @param {string} event - The socket event name
   * @param {string} message - The message describing the event
   * @param {unknown} [data] - Optional additional data to log
   * @returns {void}
   * @example
   * logger.socket('connection', 'New client connected', { socketId: 'abc123' });
   */
  socket: (event: string, message: string, data?: unknown): void => {
    console.log(
      `${colors.bright}${colors.cyan}[SOCKET]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - 🔌 [${event}] ${message}`,
      data !== undefined ? data : ''
    );
  },

  /**
   * Logs a voice call related event
   * @param {string} action - The call action (join, leave, mute, unmute, etc.)
   * @param {string} message - The message describing the action
   * @param {unknown} [data] - Optional additional data to log
   * @returns {void}
   * @example
   * logger.call('join', 'User joined call', { oderId: '123', meetingId: 'abc' });
   */
  call: (action: string, message: string, data?: unknown): void => {
    console.log(
      `${colors.bright}${colors.green}[CALL]${colors.reset} ${colors.cyan}${getTimestamp()}${colors.reset} - 📞 [${action}] ${message}`,
      data !== undefined ? data : ''
    );
  },
};
