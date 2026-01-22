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

      console.log('🔌 Connecting to MongoDB...');

      this.client = new MongoClient(uri, {
        // Optimized settings to prevent server hang
        connectTimeoutMS: 5000,    // Time to wait for initial connection
        socketTimeoutMS: 45000,    // Time to wait for inactive socket
        maxPoolSize: 10,           // Number of concurrent connections
        family: 4                  // Force IPv4 to avoid DNS resolution delays
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