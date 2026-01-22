// controllers/sellerController.js
const bcrypt = require('bcryptjs'); // FIXED: Switched from 'bcrypt' to 'bcryptjs'
const { ObjectId } = require('mongodb');
const database = require('../services/database');
const User = require('../models/User');

class SellerController {
  async createSeller(req, res) {
    try {
      const { name, email, username, password, description } = req.body;

      // Validation
      if (!name || !email || !username || !password) {
        return res.status(400).json({ 
          error: 'Name, email, username, and password are required' 
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Validate password strength (minimum 6 characters)
      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'Password must be at least 6 characters long' 
        });
      }

      const usersCollection = database.getUsersCollection();

      // Check if email + role combination already exists
      const existingEmailWithRole = await usersCollection.findOne({
        email: email,
        role: 'Seller'
      });

      if (existingEmailWithRole) {
        return res.status(409).json({ error: 'Email already registered as Seller' });
      }

      // Check if username already exists
      const existingUsername = await usersCollection.findOne({
        username: username
      });

      if (existingUsername) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Hash password using bcryptjs
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user object
      const now = new Date();
      const userData = {
        name,
        email,
        username,
        password: hashedPassword,
        role: 'Seller',
        status: 'Active',
        activity: 'Offline',
        lastLogin: null,
        description: description || '',
        createdAt: now,
        updatedAt: now
      };

      // Insert into database
      const result = await usersCollection.insertOne(userData);
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = userData;
      userWithoutPassword._id = result.insertedId;

      res.status(201).json({
        success: true,
        message: 'Seller created successfully',
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Create seller error:', error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({ 
          error: `${field} already exists` 
        });
      }
      res.status(500).json({ error: 'Failed to create seller' });
    }
  }

  async getAllSellers(req, res) {
    try {
      const usersCollection = database.getUsersCollection();
      const sellers = await usersCollection
        .find({ role: 'Seller' }, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      
      res.json(sellers);
    } catch (error) {
      console.error('Get sellers error:', error);
      res.status(500).json({ error: 'Failed to fetch sellers' });
    }
  }

  async getSellerById(req, res) {
    try {
      const { id } = req.params;
      const usersCollection = database.getUsersCollection();
      
      let query;
      try {
        query = { _id: new ObjectId(id), role: 'Seller' };
      } catch (error) {
        return res.status(400).json({ error: 'Invalid seller ID format' });
      }
      
      const seller = await usersCollection.findOne(
        query,
        { projection: { password: 0 } }
      );

      if (!seller) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      res.json(seller);
    } catch (error) {
      console.error('Get seller error:', error);
      res.status(500).json({ error: 'Failed to get seller' });
    }
  }
}

module.exports = new SellerController();