// controllers/buyerController.js
const bcrypt = require('bcryptjs'); // FIXED: Switched from 'bcrypt' to 'bcryptjs'
const { ObjectId } = require('mongodb');
const database = require('../services/database');
const User = require('../models/User');

class BuyerController {
  async register(req, res) {
    try {
      const { name, email, username, password, phone, address, company } = req.body;

      // ----------- VALIDATION -----------
      if (!name || !email || !username || !password) {
        return res.status(400).json({
          error: 'Name, email, username, and password are required'
        });
      }

      // Email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Password strength
      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters long'
        });
      }

      const usersCollection = database.getUsersCollection();

      // Check duplicate email inside Buyer role
      const existingEmail = await usersCollection.findOne({
        email: email.toLowerCase(),
        role: 'Buyer'
      });

      if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered as Buyer' });
      }

      // Check duplicate username across ALL roles
      const existingUsername = await usersCollection.findOne({
        username: username.toLowerCase()
      });

      if (existingUsername) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // ----------- PASSWORD HASHING -----------
      // bcryptjs uses the same salt and hash logic
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // ----------- BUILD FINAL USER OBJECT -----------
      const now = new Date();
      const userData = {
        name,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        role: 'Buyer',
        status: 'Active',
        activity: 'Offline',
        lastLogin: null,
        phone: phone || '',
        address: address || '',
        company: company || '',
        description: '',
        createdAt: now,
        updatedAt: now
      };

      // ----------- DATABASE INSERT -----------
      const result = await usersCollection.insertOne(userData);

      // Clean output (remove password)
      const userResponse = new User({
        ...userData,
        _id: result.insertedId
      }).toJSON();

      res.status(201).json({
        success: true,
        message: 'Buyer registered successfully',
        user: userResponse
      });

    } catch (error) {
      console.error('Buyer registration error:', error);

      // Duplicate key error handler
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({
          error: `${field} already exists`
        });
      }

      res.status(500).json({ error: 'Failed to register buyer' });
    }
  }

  // -------------------------------------------------------
  // GET BUYER BY ID
  // -------------------------------------------------------
  async getBuyerById(req, res) {
    try {
      const { id } = req.params;
      const usersCollection = database.getUsersCollection();

      let query;
      try {
        query = { _id: new ObjectId(id), role: 'Buyer' };
      } catch (error) {
        return res.status(400).json({ error: 'Invalid buyer ID format' });
      }

      const buyer = await usersCollection.findOne(query, {
        projection: { password: 0 }
      });

      if (!buyer) {
        return res.status(404).json({ error: 'Buyer not found' });
      }

      res.json(buyer);

    } catch (error) {
      console.error('Get buyer error:', error);
      res.status(500).json({ error: 'Failed to get buyer' });
    }
  }
}

module.exports = new BuyerController();