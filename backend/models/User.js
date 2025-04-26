const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Do not send password back in queries by default
    },
    profileImageUrl: {
      type: String,
      default: null, // Or a default placeholder image URL
    },
    // We might add fields for password reset tokens later if needed
    // passwordResetToken: String,
    // passwordResetExpires: Date,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    toJSON: { virtuals: true }, // Ensure virtual fields are included in JSON output
    toObject: { virtuals: true }, // Ensure virtual fields are included when converting to Object
  }
);

// --- Hooks ---

// Hash password before saving the user document
userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  next();
});

// --- Methods ---

// Instance method to check if the provided password matches the stored hashed password
userSchema.methods.comparePassword = async function (
  candidatePassword,
  userPassword // The hashed password from the database
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
