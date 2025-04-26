const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    // Create a TTL index to automatically delete expired tokens from the database
    // index: { expires: '1s' } // Check Mongoose docs for exact syntax if needed
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL index for automatic cleanup of expired tokens
// The 'expires' option specifies the TTL in seconds.
// Mongoose will use the 'expiresAt' field to determine when a document should expire.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for faster lookup by user
refreshTokenSchema.index({ user: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
