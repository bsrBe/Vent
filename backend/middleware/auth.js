const jwt = require('jsonwebtoken');
const { promisify } = require('util'); // To use async/await with jwt.verify
const User = require('../models/User'); // Assuming User model is needed to check if user still exists
const AppError = require('../utils/appError'); // Assuming a utility for handling errors

const protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Uncomment if using cookies
    // else if (req.cookies.jwt) {
    //   token = req.cookies.jwt;
    // }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verification token
    let decoded;
    try {
      // Use promisify for async/await syntax with jwt.verify
      decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    } catch (err) {
      // Handle specific JWT errors
      if (err.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again.', 401));
      } else if (err.name === 'TokenExpiredError') {
        return next(new AppError('Your token has expired! Please log in again.', 401));
      }
      // For other errors, pass them along
      return next(err);
    }


    // Check if the token type is 'access' (as defined in the original spec)
    if (decoded.type !== 'access') {
        return next(new AppError('Invalid token type provided.', 401));
    }

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          401
        )
      );
    }

    // 4) Check if user changed password after the token was issued
    // This requires a 'passwordChangedAt' field in the User model
    // if (currentUser.changedPasswordAfter(decoded.iat)) {
    //   return next(
    //     new AppError('User recently changed password! Please log in again.', 401)
    //   );
    // }

    // GRANT ACCESS TO PROTECTED ROUTE
    // Attach user to the request object
    req.user = currentUser;
    // Also attach the decoded token info if needed elsewhere (e.g., token type)
    // req.tokenInfo = decoded;
    next();
  } catch (error) {
    // Catch any unexpected errors during the process
    next(error);
  }
};

// Optional: Middleware to restrict routes to specific roles
// const restrictTo = (...roles) => {
//   return (req, res, next) => {
//     // roles ['admin', 'lead-guide']. role='user'
//     if (!roles.includes(req.user.role)) { // Assuming user model has a 'role' field
//       return next(
//         new AppError('You do not have permission to perform this action', 403)
//       );
//     }
//     next();
//   };
// };

module.exports = { protect /*, restrictTo */ }; // Export the protect middleware
