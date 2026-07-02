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

  async checkEmail(req, res) {
    try {
      const { email } = req.params;
      
      if (!email) {
        return res.status(400).json({ error: 'Email parameter is required' });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const usersCollection = database.getUsersCollection();
      
      // Check if email exists in any role
      const existingUsers = await usersCollection.find({
        email: email.toLowerCase()
      }, { projection: { password: 0 } }).toArray();

      if (existingUsers.length === 0) {
        return res.json({
          exists: false,
          message: 'Email is available',
          email: email.toLowerCase()
        });
      }

      // If email exists, return details about all users with this email
      const userDetails = existingUsers.map(user => ({
        userId: user._id,
        role: user.role,
        name: user.name,
        username: user.username,
        status: user.status,
        createdAt: user.createdAt
      }));

      console.log(`🔍 Email check: ${email.toLowerCase()} found for ${existingUsers.length} user(s)`);
      
      res.json({
        exists: true,
        message: `Email already registered by ${existingUsers.length} user(s)`,
        email: email.toLowerCase(),
        users: userDetails
      });

    } catch (error) {
      console.error('Check email error:', error);
      res.status(500).json({ error: 'Failed to check email' });
    }
  }

  async checkUsername(req, res) {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({ error: 'Username parameter is required' });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters long' });
      }

      const usersCollection = database.getUsersCollection();
      
      // Check if username exists
      const existingUser = await usersCollection.findOne({
        username: username.toLowerCase()
      }, { projection: { password: 0 } });

      if (!existingUser) {
        return res.json({
          exists: false,
          message: 'Username is available',
          username: username.toLowerCase()
        });
      }

      console.log(`🔍 Username check: ${username.toLowerCase()} exists as ${existingUser.role} with ID: ${existingUser._id}`);
      
      res.json({
        exists: true,
        message: `Username already exists as ${existingUser.role}`,
        username: username.toLowerCase(),
        user: {
          userId: existingUser._id,
          role: existingUser.role,
          name: existingUser.name,
          email: existingUser.email,
          status: existingUser.status,
          createdAt: existingUser.createdAt
        }
      });

    } catch (error) {
      console.error('Check username error:', error);
      res.status(500).json({ error: 'Failed to check username' });
    }
  }
}

module.exports = new AuthController();