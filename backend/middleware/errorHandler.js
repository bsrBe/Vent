const AppError = require('../utils/appError');

// --- Specific Error Handlers ---

// Handle Mongoose bad ObjectId
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400); // 400 Bad Request
};

// Handle Mongoose duplicate field errors
const handleDuplicateFieldsDB = (err) => {
  // Extract value from the error message
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

// Handle Mongoose validation errors
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle JWT invalid token errors
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401); // 401 Unauthorized

// Handle JWT expired token errors
const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// --- Response Sending Functions ---

// Send detailed error response in development
const sendErrorDev = (err, req, res) => {
  // A) API errors
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack, // Include stack trace
    });
  }
  // B) RENDERED WEBSITE errors (if applicable)
  console.error('ERROR 💥', err);
  // Render an error page
  // return res.status(err.statusCode).render('error', {
  //   title: 'Something went wrong!',
  //   msg: err.message
  // });
   return res.status(err.statusCode).json({ // Fallback for non-API in this setup
      title: 'Something went wrong!',
      msg: err.message
    });
};

// Send generic error response in production
const sendErrorProd = (err, req, res) => {
  // A) API errors
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // Programming or other unknown error: don't leak error details
    // 1) Log error
    console.error('ERROR 💥', err);
    // 2) Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }

  // B) RENDERED WEBSITE errors (if applicable)
   // Operational, trusted error: send message to client
  if (err.isOperational) {
     // Render an error page
    // return res.status(err.statusCode).render('error', {
    //   title: 'Something went wrong!',
    //   msg: err.message
    // });
     return res.status(err.statusCode).json({ // Fallback for non-API in this setup
      title: 'Something went wrong!',
      msg: err.message
    });
  }
   // Programming or other unknown error: don't leak error details
  // 1) Log error
  console.error('ERROR 💥', err);
  // 2) Send generic message
  // return res.status(err.statusCode).render('error', {
  //   title: 'Something went wrong!',
  //   msg: 'Please try again later.'
  // });
   return res.status(500).json({ // Fallback for non-API in this setup
      title: 'Something went wrong!',
      msg: 'Please try again later.'
    });
};

// --- Global Error Handler Middleware ---
module.exports = (err, req, res, next) => {
  // Set default status code and status if not already set
  err.statusCode = err.statusCode || 500; // Internal Server Error
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err }; // Create a hard copy
    error.message = err.message; // Copy message explicitly

    // Handle specific MongoDB/JWT errors and convert them to operational errors
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error); // MongoDB duplicate key error
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};
