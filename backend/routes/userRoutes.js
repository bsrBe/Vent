const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController'); // Needed for password change logic maybe? No, userController handles it.
const { protect } = require('../middleware/auth'); // Import protect middleware

const router = express.Router();

// All user routes below require authentication
router.use(protect);

// Profile routes
router.get('/profile', userController.getProfile); // GET /api/v1/users/profile (uses authController.me logic internally via protect)
router.patch('/profile', userController.updateProfile); // PATCH /api/v1/users/profile (update name/email)

// Password change route
router.patch('/change-password', userController.changePassword); // PATCH /api/v1/users/change-password

// Profile image upload route
// Uses multer middleware defined in userController
router.post('/profile-image', userController.uploadUserPhoto, userController.uploadProfileImage); // POST /api/v1/users/profile-image

// Note: The backend.txt example had /auth/me for getting the current user.
// We have implemented that in authRoutes.js.
// This file focuses on user-specific actions like profile updates and password changes.
// The GET /profile route here essentially does the same as GET /auth/me by returning req.user.

module.exports = router;
