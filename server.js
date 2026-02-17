'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io'); 
const database = require('./services/database');

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------
// 1. DYNAMIC CORS SETTINGS (FIXED FOR MOBILE/RENDER)
// ---------------------------------------------------------
const whitelist = [
  'https://render-backend-steel-suvidha.onrender.com', 
  'http://localhost:3000',
  'http://localhost:4000',
  'http://10.120.58.209:4000',
  'http://10.120.58.209:10000' // Added Render's local port just in case
];

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow mobile apps (origin is undefined)
    // 2. Allow whitelist matches
    // 3. Allow all if not in production mode
    if (!origin || whitelist.some(w => origin.startsWith(w)) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('🛑 CORS Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// ---------------------------------------------------------
// 2. SOCKET.IO CONFIGURATION
// ---------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: "*", // Keep this "*" for mobile compatibility
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000, 
  pingInterval: 25000
});

app.set('io', io);

// ---------------------------------------------------------
// 3. ENVIRONMENT & ROUTES
// ---------------------------------------------------------
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Connection Testing Routes
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    status: 'Online', 
    env: process.env.NODE_ENV,
    database: database.isConnected ? 'Connected' : 'Disconnected' 
  });
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

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------
// 4. START LOGIC (FIXED FOR RENDER)
// ---------------------------------------------------------
async function startServer() {
  const portNumber = parseInt(PORT, 10);

  // Use '0.0.0.0' for Render and mobile access
  server.listen(portNumber, '0.0.0.0', async () => {
    console.log(`✅ Server is OPEN on Port ${portNumber}`);
    
    // Help identify the environment in logs
    if (process.env.RENDER) {
       console.log(`📡 Render URL: https://render-backend-steel-suvidha.onrender.com`);
    } else {
       console.log(`📡 Local IP: http://10.120.58.209:${portNumber}`);
    }
    
    try {
      console.log('🔌 Connecting to MongoDB...');
      await database.connect(MONGO_URI);
      console.log('🍃 MongoDB Connected Successfully');
    } catch (dbError) {
      console.error('⚠️ Database connection failed:', dbError.message);
    }
  });
}

startServer();