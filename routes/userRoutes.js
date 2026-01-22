// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const database = require('../services/database');

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const usersCollection = database.getUsersCollection();
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;

