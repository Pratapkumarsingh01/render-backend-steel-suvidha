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
// 1. DYNAMIC CORS SETTINGS
// ---------------------------------------------------------
const whitelist = [
  'https://render-backend-steel-suvidha.onrender.com', 
  'http://localhost:3000',
  'http://127.0.0.1:27017'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || whitelist.some(w => origin.startsWith(w))) {
      callback(null, true);
    } else {
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
    origin: "*", 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: process.env.NODE_ENV === 'production' ? ['websocket'] : ['polling', 'websocket'], 
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
let MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI || MONGO_URI.length < 10) {
  console.error('❌ Missing or Invalid MONGO_URI in .env');
  process.exit(1);
}

// Health Check
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'Online', clients: io.engine.clientsCount });
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------
// 4. START & SHUTDOWN LOGIC
// ---------------------------------------------------------

// Graceful shutdown function (FIXED: Restored missing function)
const shutdown = async () => {
  console.log('\n🛑 Shutting down server...');
  try {
    await database.close();
    console.log('✅ Database connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

async function startServer() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await database.connect(MONGO_URI);
    
    const portNumber = parseInt(PORT, 10);
    server.listen(portNumber, '0.0.0.0', () => {
      console.log(`✅ Production Server running on Port ${portNumber}`);
      console.log(`🚀 Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Startup Failed:', error.message);
    setTimeout(() => process.exit(1), 1000);
  }
}

// Listen for termination signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();