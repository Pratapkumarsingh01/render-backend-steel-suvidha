// Backend_steel_suvidha/services/database.js
const { MongoClient } = require('mongodb');

/**
 * DatabaseService handles the connection and collection initialization 
 * for the MongoDB database.
 */
class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
    // Collection placeholders
    this.users = null;
    this.products = null;
    this.quotes = null;
  }

  /**
   * Connects to the MongoDB cluster using the provided URI.
   * @param {string} uri - The MongoDB connection string.
   */
  async connect(uri) {
    try {
      // Prevent multiple connections
      if (this.client) return;

      console.log('🔌 Attempting connection with IPv4 forced...');
      console.log('🔌 Connecting to MongoDB...');

      // FIXED: Force IPv4 and use basic connection string to bypass DNS issues
      this.client = new MongoClient(uri, {
        // Force IPv4 to bypass DNS resolution issues
        family: 4,
        // Optimized settings for network issues
        connectTimeoutMS: 15000,   // Increased timeout for connection
        socketTimeoutMS: 60000,    // Time to wait for inactive socket
        maxPoolSize: 5,            // Reduced pool size for stability
        serverSelectionTimeoutMS: 15000, // Timeout for server selection
        // Use direct connection to avoid DNS lookups
        directConnection: false,
        // Force specific replica set if needed
        retryWrites: true,
        w: 'majority'
      });

      await this.client.connect();
      
      // Select the database (uses name from URI or defaults to 'test')
      this.db = this.client.db(); 
      
      console.log('🍃 MongoDB Connected Successfully');

      // Initialize collections - Ensure these names match your DB exactly
      this.users = this.db.collection('users');
      this.products = this.db.collection('products');
      this.quotes = this.db.collection('quotes');

      // Test the connection by pinging
      await this.db.command({ ping: 1 });
      
    } catch (error) {
      console.error('❌ MongoDB Connection Failed:', error.message);
      // Clean up failed client
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      throw error;
    }
  }

  /**
   * Getter methods for collections
   */
  getUsersCollection() {
    if (!this.users) throw new Error('Database not connected. Call connect() first.');
    return this.users;
  }

  getProductsCollection() {
    if (!this.products) throw new Error('Database not connected. Call connect() first.');
    return this.products;
  }

  getQuotesCollection() {
    if (!this.quotes) throw new Error('Database not connected. Call connect() first.');
    return this.quotes;
  }

  /**
   * Gracefully close the connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('🛑 MongoDB connection closed.');
    }
  }
}

// Export a singleton instance
module.exports = new DatabaseService();