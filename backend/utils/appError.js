/**
 * Custom error class for operational errors (errors we can predict).
 * Extends the built-in Error class.
 */
class AppError extends Error {
  /**
   * Creates an instance of AppError.
   * @param {string} message - The error message.
   * @param {number} statusCode - The HTTP status code (e.g., 400, 404, 500).
   */
  constructor(message, statusCode) {
    super(message); // Call the parent constructor (Error)

    this.statusCode = statusCode;
    // Determine status based on statusCode (fail for 4xx, error for 5xx)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // Mark this error as operational (trusted error, not a programming bug)
    this.isOperational = true;

    // Capture the stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
