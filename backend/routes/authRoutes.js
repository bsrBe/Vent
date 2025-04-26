const express = require('express');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth'); // Import protect middleware

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
// The reset token is expected in the URL params for the resetPassword route
router.patch('/resetPassword/:token', authController.resetPassword); // Changed to PATCH as it modifies the user resource

// Protected routes (require authentication)
router.post('/logout', protect, authController.logout); // Logout might need protection depending on logic
router.get('/me', protect, authController.me); // Get current user profile

module.exports = router;
