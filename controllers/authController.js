// controllers/authController.js
const bcrypt = require('bcryptjs'); // UPDATED: Switched from 'bcrypt' to 'bcryptjs'
const { ObjectId } = require('mongodb');
const database = require('../services/database');
const User = require('../models/User');

class AuthController {
  async login(req, res) {
    try {
      const { username, password, role } = req.body;

      if (!username || !password || !role) {
        return res.status(400).json({ 
          error: 'Username, password, and role are required' 
        });
      }

      const usersCollection = database.getUsersCollection();
      
      // Find user by username and role
      const userDoc = await usersCollection.findOne({ 
        username: username,
        role: role 
      });

      if (!userDoc) {
        return res.status(401).json({ 
          error: 'Invalid credentials' 
        });
      }

      // Verify password using bcryptjs
      // compare() works exactly the same way as it did with the native bcrypt
      const isPasswordValid = await bcrypt.compare(password, userDoc.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: 'Invalid credentials' 
        });
      }

      // Update last login
      await usersCollection.updateOne(
        { _id: userDoc._id },
        { 
          $set: { 
            lastLogin: new Date(),
            activity: 'Online',
            updatedAt: new Date()
          } 
        }
      );

      // Return user without password
      const { password: _, ...userWithoutPassword } = userDoc;
      res.json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  }

  async getProfile(req, res) {
    try {
      const { userId } = req.params;
      const usersCollection = database.getUsersCollection();
      
      let query;
      try {
        query = { _id: new ObjectId(userId) };
      } catch (error) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      
      const user = await usersCollection.findOne(
        query,
        { projection: { password: 0 } }
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }
}

module.exports = new AuthController();