const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto'); // For generating reset tokens
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const generateTokens = require('../utils/generateToken');
const { sendEmail } = require('../config/mail'); // Assuming sendEmail is exported from mail config
const { addDays } = require('date-fns'); // For setting refresh token expiry

// Helper function to send tokens in response (can be cookie or JSON)
const sendTokenResponse = async (user, statusCode, req, res) => {
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Save the refresh token to the database
  await RefreshToken.create({
    token: refreshToken, // Store the actual token string
    user: user._id,
    expiresAt: addDays(new Date(), parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '7')), // Use env variable or default
  });

  // --- Option 1: Send tokens in cookies (more secure for web) ---
  const cookieOptions = {
    expires: new Date(
      Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '7')) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // Prevent access from JavaScript
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https', // Only send over HTTPS
  };
  // res.cookie('refreshToken', refreshToken, cookieOptions); // Consider sending refresh token in cookie

  // --- Option 2: Send tokens in JSON response body ---
  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    accessToken, // Send access token in body
    refreshToken, // Send refresh token in body (less secure than httpOnly cookie)
    data: {
      user,
    },
  });
};


exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password, passwordConfirm } = req.body;

  if (!name || !email || !password || !passwordConfirm) {
    return next(new AppError('Please provide name, email, password, and password confirmation', 400));
  }

  if (password !== passwordConfirm) {
    return next(new AppError('Passwords do not match', 400));
  }

  // Check if user already exists (Mongoose returns null if not found)
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('Email is already in use', 400));
  }

  // Create user (password hashing is handled by pre-save hook in User model)
  const newUser = await User.create({
    name,
    email,
    password,
    // passwordConfirm is only for validation, not saved
  });

  // Send tokens and user data
  await sendTokenResponse(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password'); // Explicitly select password

  if (!user || !(await user.comparePassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything ok, send token to client
  await sendTokenResponse(user, 200, req, res);
});

exports.refresh = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  // Find the refresh token in the database
  const tokenRecord = await RefreshToken.findOne({ token: refreshToken });

  // Check if token exists and hasn't expired
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    // Optionally remove the invalid/expired token
    if (tokenRecord) await RefreshToken.findByIdAndDelete(tokenRecord._id);
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  // Verify the user associated with the token still exists
  const user = await User.findById(tokenRecord.user);
  if (!user) {
    await RefreshToken.findByIdAndDelete(tokenRecord._id); // Clean up token for non-existent user
    return next(new AppError('User belonging to this token no longer exists', 401));
  }

  // Generate new tokens
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

  // Delete the old refresh token
  await RefreshToken.findByIdAndDelete(tokenRecord._id);

  // Save the new refresh token
  await RefreshToken.create({
    token: newRefreshToken,
    user: user._id,
    expiresAt: addDays(new Date(), parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || '7')),
  });

  res.status(200).json({
    status: 'success',
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

exports.logout = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Delete the specific refresh token from the database
    await RefreshToken.deleteOne({ token: refreshToken });
  }

  // Optional: Clear cookies if used
  // res.cookie('refreshToken', 'loggedout', {
  //   expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
  //   httpOnly: true,
  // });

  res.status(200).json({ status: 'success', message: 'Logout successful' });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    // Don't reveal that the user doesn't exist for security
    return res.status(200).json({ status: 'success', message: 'If the email exists, a password reset token has been sent.' });
    // return next(new AppError('There is no user with that email address.', 404));
  }

  // 2) Generate the random reset token (using crypto for more secure random bytes)
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the token before saving to DB (similar to password hashing)
  user.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set token expiry (e.g., 10 minutes)
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes in milliseconds

  await user.save({ validateBeforeSave: false }); // Save updated user doc (disable validation for temp fields)

  // 3) Send it to user's email
  // Construct reset URL (adjust frontend URL as needed)
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`; // Or your frontend URL: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email! This link is valid for 10 minutes.`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      text: message,
      // html: '<strong>and easy to do anywhere, even with Node.js</strong>', // Optional HTML version
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    // If email sending fails, reset the token fields in the DB
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!', 500)
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token) // Use the token from the URL parameter
    .digest('hex');

  // Find user by the hashed token and ensure the token hasn't expired
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // Check if expiry is greater than now
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  if (!req.body.password || !req.body.passwordConfirm) {
      return next(new AppError('Please provide password and password confirmation', 400));
  }

  if (req.body.password !== req.body.passwordConfirm) {
      return next(new AppError('Passwords do not match', 400));
  }

  // Update password (pre-save hook will hash it)
  user.password = req.body.password;
  // Clear the reset token fields
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); // Use regular save to trigger validation and pre-save hooks

  // 3) Invalidate all existing refresh tokens for this user
  await RefreshToken.deleteMany({ user: user._id });

  // 4) Log the user in, send JWT
  await sendTokenResponse(user, 200, req, res);
});


// Get current user based on the protect middleware
exports.me = catchAsync(async (req, res, next) => {
  // req.user is attached by the protect middleware
  if (!req.user) {
    return next(new AppError('User not found.', 404)); // Should not happen if protect middleware works
  }

  // Respond with user data (password is not selected by default)
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});
