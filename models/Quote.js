// Backend_steel_suvidha/models/Quote.js
/**
 * Quote Schema Definition for MongoDB
 * This file documents the structure of quotes in the database.
 * Since we're using MongoDB directly (not Mongoose), this serves as documentation.
 */

const quoteSchema = {
  _id: ObjectId, // Auto-generated MongoDB ID
  
  // Buyer Information
  buyerId: String,           // Required: ID of the buyer who created the quote
  buyerName: String,         // Required: Name of the buyer
  
  // Product Information
  productName: String,      // Required: Main product name (derived from first item)
  requestedQuantity: Number, // Required: Total quantity requested
  items: [{
    productId: String,      // Optional: Product ID if from master catalog
    productName: String,    // Required: Product name
    quantity: String        // Required: Quantity for this item
  }],
  
  // Quote Status & Management
  status: String,           // Required: 'Pending', 'Quoted', 'Accepted', 'Rejected'
  isBroadcast: Boolean,     // Required: true if sent to multiple sellers
  broadcastStatus: String,  // Optional: 'BROADCASTED', 'NO_SELLERS', 'GENERAL_BROADCAST'
  
  // Seller Information (for single-seller quotes)
  sellerId: String,         // Optional: Specific seller ID (null for broadcast)
  sellerName: String,       // Optional: Specific seller name
  
  // Bidding System - MULTIPLE SELLER OFFERS
  offers: [{
    offerId: String,        // Required: Unique identifier for this offer
    sellerId: String,       // Required: ID of the seller making this offer
    sellerName: String,     // Required: Name of the seller
    offeredPrice: Number,   // Required: Price offered by this seller
    message: String,        // Optional: Message from seller to buyer
    status: String,         // Required: 'Pending', 'Accepted', 'Rejected'
    timestamp: Date         // Required: When this offer was made
  }],
  
  // Accepted Offer Information (populated when buyer accepts)
  acceptedOfferId: String,   // Optional: ID of the accepted offer
  finalPrice: Number,       // Optional: Final accepted price
  sellerId: String,         // Optional: ID of the accepted seller (copied from offer)
  sellerName: String,       // Optional: Name of the accepted seller (copied from offer)
  
  // Additional Information
  buyerAddress: String,     // Optional: Delivery address
  targetedPrice: Number,    // Optional: Buyer's target price
  deliveryDate: Date,       // Optional: Requested delivery date
  
  // Broadcasting Information
  matchedSellersCount: Number, // Optional: Number of sellers matched for broadcast
  matchedSellers: [{
    sellerId: String,       // Required: Matched seller ID
    sellerName: String      // Required: Matched seller name
  }],
  
  // Timestamps
  createdAt: Date,          // Required: When quote was created
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
    const { ObjectId } = require('mongodb');
    
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
