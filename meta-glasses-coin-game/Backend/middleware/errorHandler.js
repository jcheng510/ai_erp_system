/**
 * Central error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details || err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.message
    });
  }

  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this value already exists'
    });
  }

  if (err.code === 'P2025') {
    // Prisma record not found
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found'
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

/**
 * Async handler wrapper to catch errors in async routes
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create custom error with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError
};
