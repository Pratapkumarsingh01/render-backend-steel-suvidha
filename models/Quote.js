/**
 * Quote Schema Definition for MongoDB
 * This file documents the structure of quotes in the database.
 * Since we're using MongoDB directly (not Mongoose), this serves as documentation.
 */

const { ObjectId } = require('mongodb');

const quoteSchema = {
  _id: ObjectId, // Auto-generated MongoDB ID
  
  // Buyer Information
  buyerId: String,           // Required: ID of the buyer who created the quote
  buyerName: String,         // Required: Name of the buyer
  
  // Product Information
  productName: String,      // Required: Main product name (derived from first item, e.g. "Round Pipe (Pipes)")
  requestedQuantity: Number, // Required: Total quantity requested (Sum of item quantities)
  
  // FIXED: Expanded to explicitly document multi-item custom structures
  items: [{
    productId: String,      // Optional: Product ID if from master catalog selection
    productName: String,    // Required: Product description string (e.g. "HR Sheets (TATA, 8 G) (Kgs)")
    category: String,       // Required: Root classification key passed from frontend (e.g., "Pipes", "HR Sheets")
    quantity: Number,       // Required: Numerical item quantity (Changed from String to match controller calculations)
    unit: String,           // Required: Chosen measurement metric ("Kgs" or "Pcs")
    deliveryDate: String    // Required: Custom item-specific delivery ISO8601 string requested from customer end
  }],
  
  // Quote Status & Management
  status: String,           // Required: 'Pending', 'Quoted', 'Accepted', 'Rejected'
  deliveryStatus: String,   // Optional: 'In Progress', 'Dispatched', 'Out for Delivery', 'Delivered'
  isBroadcast: Boolean,     // Required: true if sent to multiple sellers
  broadcastStatus: String,  // Optional: 'BROADCASTED', 'NO_SELLERS', 'GENERAL_BROADCAST'
  
  // Seller Information (for single-seller direct entries)
  sellerId: String,         // Optional: Specific seller ID (null for broadcast requests)
  sellerName: String,       // Optional: Specific seller name
  
  // Bidding System - MULTIPLE SELLER OFFERS
  offers: [{
    offerId: String,        // Required: Unique identifier for this offer
    sellerId: String,       // Required: ID of the seller making this offer
    sellerName: String,     // Required: Name of the seller
    offeredPrice: Number,   // Required: Price offered by this seller per specific unit
    message: String,        // Optional: Message/Notes from seller to buyer
    status: String,         // Required: 'Pending', 'Accepted', 'Rejected'
    timestamp: Date         // Required: When this offer was made
  }],
  
  // Accepted Offer Information (populated when buyer accepts an offer)
  // FIXED: Removed duplicate sellerId / sellerName object properties
  acceptedOfferId: String,   // Optional: ID of the accepted offer
  finalPrice: Number,       // Optional: Final accepted price
  sellerId: String,         // Optional: ID of the accepted seller (copied from offer object)
  sellerName: String,       // Optional: Name of the accepted seller (copied from offer object)
  
  // Buyer Contact Information (Privacy Protected: Only visible after seller offer is explicitly accepted)
  buyerDetails: {           
    name: String,           // Required: Buyer's full business name
    phoneNumber: String,     // Required: Buyer's phone number
    address: String,        // Required: Structured complete delivery address
    email: String          // Optional: Buyer's email
  },
  
  // Legacy / Fallback Fields
  buyerAddress: String,     // Optional: Combined delivery address string
  buyerPhone: String,       // Optional: Buyer's phone number string
  buyerEmail: String,       // Optional: Buyer's email string
  targetedPrice: Number,    // Optional: Legacy fallback aggregate target budget
  deliveryDate: Date,       // Optional: Legacy global requested date
  
  // Broadcasting Target Information
  matchedSellersCount: Number, // Optional: Number of active target sellers matched for broadcast
  matchedSellers: [{
    sellerId: String,       // Required: Matched seller ID
    sellerName: String      // Required: Matched seller name
  }],
  
  // Timestamps
  createdAt: Date,          // Required: When quote request was logged
  updatedAt: Date           // Required: When quote was last updated
};

module.exports = {
  quoteSchema,
  
  // Helper function to validate offer structure
  validateOffer: (offer) => {
    const required = ['offerId', 'sellerId', 'sellerName', 'offeredPrice', 'status', 'timestamp'];
    const missing = required.filter(field => !offer[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required offer fields: ${missing.join(', ')}`);
    }
    
    return true;
  },
  
  // Helper function to create a new offer object
  createOffer: (sellerId, sellerName, offeredPrice, message = '') => {
    return {
      offerId: new ObjectId().toString(),
      sellerId: sellerId,
      sellerName: sellerName,
      offeredPrice: offeredPrice,
      message: message,
      status: 'Pending',
      timestamp: new Date()
    };
  }
};