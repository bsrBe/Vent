const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { uploadBufferToCloudinary } = require('../utils/storage');
const multer = require('multer');

// --- Multer Configuration ---

// Store image in memory as a buffer
const multerStorage = multer.memoryStorage();

// Filter files to allow only images
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// Configure multer upload instance
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Example: 5MB limit
});

// Middleware to handle single image upload for the 'profileImage' field
exports.uploadUserPhoto = upload.single('profileImage'); // Field name in the form-data

// --- Controller Methods ---

// Get user profile (uses req.user from protect middleware)
exports.getProfile = catchAsync(async (req, res, next) => {
  // req.user is already populated by the protect middleware
  // We just need to send it back (password is not selected by default)
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

// Filter allowed fields for update
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// Update user profile (name, email)
exports.updateProfile = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /change-password.',
        400
      )
    );
  }

  // 2) Filter out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');

  // 3) Check if email is being updated and if it's already taken
  if (filteredBody.email) {
      const existingUser = await User.findOne({ email: filteredBody.email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
          return next(new AppError('Email address is already in use.', 400));
      }
  }

  // 4) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true, // Return the updated document
    runValidators: true, // Run schema validators on update
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

// Change user password
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // 1) Get user from collection (need password)
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if posted current password is correct
  if (!currentPassword || !(await user.comparePassword(currentPassword, user.password))) {
    return next(new AppError('Your current password is incorrect', 401));
  }

  // 3) Check if new password and confirmation match
  if (!newPassword || !confirmPassword || newPassword !== confirmPassword) {
    return next(new AppError('New password and confirmation do not match', 400));
  }

   // Check password length (or other rules) - Mongoose validator handles this on save
   if (newPassword.length < 8) {
       return next(new AppError('Password must be at least 8 characters long', 400));
   }

  // 4) If so, update password (pre-save hook will hash it)
  user.password = newPassword;
  await user.save(); // Use save() to trigger pre-save hooks like hashing

  // 5) Log user in, send JWT? Or just confirm success?
  // For simplicity, just confirm success. User's existing token remains valid until expiry.
  // If immediate invalidation of old tokens is needed, more complex logic is required.

  res.status(200).json({
      status: 'success',
      message: 'Password changed successfully.'
      // Optionally send new tokens if desired
  });
});

// Upload profile image
exports.uploadProfileImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload an image file.', 400));
  }

  // Use user ID for a unique filename/public_id in Cloudinary
  const publicId = `user-${req.user.id}`;
  const folder = `profile-images`; // Define a folder in Cloudinary

  try {
    const result = await uploadBufferToCloudinary(req.file.buffer, folder, publicId);

    // Update user's profileImageUrl field
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { profileImageUrl: result.secure_url }, // Use the secure URL from Cloudinary
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    // Handle potential upload errors
    return next(new AppError(`Image upload failed: ${error.message}`, 500));
  }
});
