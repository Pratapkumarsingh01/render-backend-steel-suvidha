// controllers/authController.js
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const database = require('../services/database');
const User = require('../models/User');
const { Resend } = require('resend'); // HTTP Email Client (Bypasses Render SMTP Block)

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

  // ─── 🔑 STEP 1: GENERATE & EMAIL 6-DIGIT OTP VIA RESEND HTTP API ───
  async forgotPassword(req, res) {
    try {
      const { identity } = req.body;
      if (!identity) {
        return res.status(400).json({ error: 'Username or email identifier required.' });
      }

      const usersCollection = database.getUsersCollection();
      const cleanIdentity = identity.trim();
      
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
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

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

      // --- RESEND HTTP API TRANSMISSION ENGINE ---
      const resend = new Resend(process.env.RESEND_API_KEY);

      const emailResponse = await resend.emails.send({
        from: 'Steel Suvidha Console <onboarding@resend.dev>',
        to: userDoc.email,
        subject: '🔒 Your Steel Suvidha Password Reset OTP',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0a0e29; color: #ffffff; border-radius: 12px; border: 1px solid #1e293b;">
            <h2 style="color: #ffb300; margin-bottom: 12px;">Steel Suvidha Network</h2>
            <p style="font-size: 14px; color: #cbd5e1;">Hello <strong>${userDoc.name || 'User'}</strong>,</p>
            <p style="font-size: 14px; color: #cbd5e1;">Your 6-digit verification code to reset your account password is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ffb300; padding: 16px 0;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 12px;">This security OTP is valid for 10 minutes. If you did not request a password reset, please ignore this message.</p>
          </div>
        `,
      });

      console.log(`📬 [Resend OTP Sent] Target: ${userDoc.email} | ID: ${emailResponse.id}`);

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

      if (!userDoc.resetOtp || userDoc.resetOtp !== otp.trim()) {
        return res.status(400).json({ error: 'Invalid OTP entered. Please check your email.' });
      }

      if (new Date() > new Date(userDoc.resetOtpExpires)) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

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

      console.log(`✅ Password updated for user: ${userDoc.username}`);
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