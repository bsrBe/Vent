const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

/**
 * Generates JWT access and refresh tokens for a given user ID.
 * @param {string} userId - The ID of the user.
 * @returns {{accessToken: string, refreshToken: string}} - An object containing the access and refresh tokens.
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' }, // Payload includes user ID and token type
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' } // Access token expiry from env or default
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' }, // Payload includes user ID and token type
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, // Use a separate refresh secret if available
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } // Refresh token expiry from env or default
  );

  return { accessToken, refreshToken };
};

module.exports = generateTokens;
