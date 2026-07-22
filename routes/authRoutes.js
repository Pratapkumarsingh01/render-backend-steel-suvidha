// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/login - User login
router.post('/login', authController.login.bind(authController));

// GET /api/auth/profile/:userId - Get user profile
router.get('/profile/:userId', authController.getProfile.bind(authController));

// GET /api/auth/check-email/:email - Check if email exists
router.get('/check-email/:email', authController.checkEmail.bind(authController));

// GET /api/auth/check-username/:username - Check if username exists
router.get('/check-username/:username', authController.checkUsername.bind(authController));

// POST /api/auth/forgot-password - Step 1: Request 6-digit OTP
router.post('/forgot-password', authController.forgotPassword.bind(authController));

// POST /api/auth/reset-password - Step 2: Verify OTP & set new password
router.post('/reset-password', authController.resetPassword.bind(authController));

// DELETE /api/auth/delete-account/:userId - Delete account
router.delete('/delete-account/:userId', authController.deleteAccount.bind(authController));

module.exports = router;