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

// PUT /api/users/:id - Update user profile (e.g. Bank details)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const usersCollection = database.getUsersCollection();
    const { ObjectId } = require('mongodb');

    // Prevent updating critical fields like password directly here if needed
    delete updateData._id;
    delete updateData.password;
    updateData.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;

