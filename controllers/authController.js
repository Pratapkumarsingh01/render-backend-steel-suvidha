// controllers/authController.js
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const database = require('../services/database');
const User = require('../models/User');
const nodemailer = require('nodemailer'); 

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
      
      const userDoc = await usersCollection.findOne({ 
        username: username,
        role: role 
      });

      if (!userDoc) {
        return res.status(401).json({ 
          error: 'Invalid credentials' 
        });
      }

      const isPasswordValid = await bcrypt.compare(password, userDoc.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: 'Invalid credentials' 
        });
      }

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

  // ─── 🔑 STEP 1: GENERATE & EMAIL 6-DIGIT OTP ───
  async forgotPassword(req, res) {
    try {
      const { identity } = req.body;
      if (!identity) {
        return res.status(400).json({ error: 'Username or email identifier entry required.' });
      }

      const usersCollection = database.getUsersCollection();
      const cleanIdentity = identity.trim();
      
      // Case-insensitive regex lookup for username or email
      const userDoc = await usersCollection.findOne({
        $or: [
          { username: { $regex: `^${cleanIdentity}$`, $options: 'i' } },
          { email: { $regex: `^${cleanIdentity}$`, $options: 'i' } }
        ]
      });

      if (!userDoc || !userDoc.email) {
        return res.status(404).json({ error: 'No user account found with that username or email.' });
      }

      // Generate a clean 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // Valid for 10 minutes

      // Store OTP and expiry in MongoDB
      await usersCollection.updateOne(
        { _id: userDoc._id },
        { 
          $set: { 
            resetOtp: otp,
            resetOtpExpires: otpExpires,
            updatedAt: new Date()
          } 
        }
      );

      // Transporter configuration using standard environment variables
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'manage.steelsuvidha@gmail.com', 
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        from: `"Steel Suvidha Console" <${process.env.EMAIL_USER || 'steelsuvidha.patna@gmail.com'}>`,
        to: userDoc.email,
        subject: '🔒 Your Steel Suvidha Password Reset OTP',
        text: `Hello ${userDoc.name || 'User'},\n\nYour 6-digit Verification OTP for resetting your password is:\n\n👉 ${otp} 👈\n\nThis OTP is valid for 10 minutes. If you did not request this, please ignore this email.\n\nRegards,\nSteel Suvidha Team`,
      };

      await transporter.sendMail(mailOptions);
      console.log(`📬 OTP [${otp}] sent to: ${userDoc.email}`);

      res.json({ 
        success: true, 
        message: `OTP sent successfully to ${userDoc.email.substring(0, 3)}***@${userDoc.email.split('@')[1]}`,
        email: userDoc.email
      });

    } catch (error) {
      console.error('Password reset OTP error:', error);
      res.status(500).json({ error: 'Failed to send OTP email. Please check server logs.' });
    }
  }

  // ─── 🔑 STEP 2: VERIFY OTP & UPDATE PASSWORD ───
  async resetPassword(req, res) {
    try {
      const { identity, otp, newPassword } = req.body;

      if (!identity || !otp || !newPassword) {
        return res.status(400).json({ error: 'Identity, OTP, and new password are required.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const usersCollection = database.getUsersCollection();
      const cleanIdentity = identity.trim();

      const userDoc = await usersCollection.findOne({
        $or: [
          { username: { $regex: `^${cleanIdentity}$`, $options: 'i' } },
          { email: { $regex: `^${cleanIdentity}$`, $options: 'i' } }
        ]
      });

      if (!userDoc) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Check if OTP matches and is not expired
      if (!userDoc.resetOtp || userDoc.resetOtp !== otp.trim()) {
        return res.status(400).json({ error: 'Invalid OTP entered. Please check your email.' });
      }

      if (new Date() > new Date(userDoc.resetOtpExpires)) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

      // Hash new password and clear the OTP fields
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await usersCollection.updateOne(
        { _id: userDoc._id },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          },
          $unset: {
            resetOtp: "",
            resetOtpExpires: ""
          }
        }
      );

      console.log(`✅ Password successfully updated for user: ${userDoc.username}`);
      res.json({ success: true, message: 'Password updated successfully! You can now log in.' });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  }

  // ─── 🗑️ GOOGLE PLAY COMPLIANT ACCOUNT DELETION PURGE ENDPOINT ───
  async deleteAccount(req, res) {
    try {
      const { userId } = req.params;
      const usersCollection = database.getUsersCollection();

      let targetId;
      try {
        targetId = new ObjectId(userId);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid user ID format.' });
      }

      const deletionResult = await usersCollection.deleteOne({ _id: targetId });

      if (deletionResult.deletedCount === 0) {
        return res.status(404).json({ error: 'Profile not found or already deleted.' });
      }

      console.log(`🗑️ Account Purged Successfully: User Document ID ${userId}`);
      res.json({ success: true, message: 'Account permanently removed from database.' });

    } catch (error) {
      console.error('Account deletion execution crash:', error);
      res.status(500).json({ error: 'Failed to execute profile deletion sequence.' });
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

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const usersCollection = database.getUsersCollection();
      
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

      const userDetails = existingUsers.map(user => ({
        userId: user._id,
        role: user.role,
        name: user.name,
        username: user.username,
        status: user.status,
        createdAt: user.createdAt
      }));

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