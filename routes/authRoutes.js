// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/login - User login
router.post('/login', authController.login.bind(authController));

// GET /api/auth/profile/:userId - Get user profile
router.get('/profile/:userId', authController.getProfile.bind(authController));

module.exports = router;

