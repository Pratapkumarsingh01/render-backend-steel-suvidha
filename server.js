'use strict';

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io'); 
const database = require('./services/database');

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------
// 1. DYNAMIC CORS SETTINGS (UPDATED: New Laptop IP)
// ---------------------------------------------------------
const whitelist = [
  'https://render-backend-steel-suvidha.onrender.com', 
  'http://localhost:3000',
  'http://localhost:4000',
  'http://10.120.58.209:4000', // FIXED: Updated to your current active IP
  'http://127.0.0.1:27017'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allows requests with no origin (mobile apps) or matching whitelist
    if (!origin || whitelist.some(w => origin.startsWith(w)) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('🛑 CORS Blocked Origin:', origin); // Log blocked origins for debugging
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Global Middleware
app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------------------------------------
// 2. SOCKET.IO CONFIGURATION
// ---------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all for testing, restrict in production
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // Force both for better compatibility
  allowEIO3: true,
  pingTimeout: 60000, 
  pingInterval: 25000
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`🔌 Client Connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`❌ Client Disconnected: ${socket.id} | Reason: ${reason}`);
  });
});

// ---------------------------------------------------------
// 3. ENVIRONMENT & ROUTES
// ---------------------------------------------------------
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Connection Testing Routes
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'Online', database: database.isConnected ? 'Connected' : 'Disconnected' });
});

app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/sellers', require('./routes/sellerRoutes'));
app.use('/api/buyers', require('./routes/buyerRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/quotes', require('./routes/quoteRoutes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler (MUST BE DEFINED LAST)
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ---------------------------------------------------------
// 4. START & SHUTDOWN LOGIC
// ---------------------------------------------------------

const shutdown = async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    // Timeout-protected database close to prevent "zombie" processes
    const dbClose = database.close();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Close Timeout')), 5000));
    
    await Promise.race([dbClose, timeout]);
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Shutdown Error:', err.message);
    process.exit(1);
  }
};

async function startServer() {
  const portNumber = parseInt(PORT, 10);

  // Bind to 0.0.0.0 to accept external LAN connections (your phone)
  server.listen(portNumber, '0.0.0.0', async () => {
    console.log(`✅ Server is OPEN on Port ${portNumber}`);
    console.log(`📡 Access locally at: http://10.120.58.209:${portNumber}/api/ping`);
    
    try {
      console.log('🔌 Connecting to MongoDB...');
      await database.connect(MONGO_URI);
      console.log('Successfully connected to MongoDB.');
    } catch (dbError) {
      console.error('⚠️ Database connection failed. Check your MONGO_URI.');
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();