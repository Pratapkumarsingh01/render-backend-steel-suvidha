const express = require('express');
const router = express.Router();
const quoteController = require('../controllers/quoteController');

// 1. CREATE QUOTE
// POST /api/quotes - Create a new quote request (from Cart or Product page)
router.post('/', quoteController.createQuote.bind(quoteController));

// 2. FETCH QUOTES
// GET /api/quotes/available - Fetch broadcasted quotes for all sellers
// This must stay ABOVE the /:id routes
router.get('/available', quoteController.getAvailableQuotes.bind(quoteController));

// NEW: FETCH SINGLE QUOTE DETAILS (Added to fix bid visibility issue)
// GET /api/quotes/:id - Fetch full details for a single quote, including all bids
router.get('/:id', quoteController.getQuoteById.bind(quoteController));

// GET /api/quotes/buyer/:buyerId - Get all quotes for a buyer
router.get('/buyer/:buyerId', quoteController.getQuotesByBuyer.bind(quoteController));

// GET /api/quotes/seller/:sellerId - Get all quotes for a seller
router.get('/seller/:sellerId', quoteController.getQuotesBySeller.bind(quoteController));

// 3. BIDDING SYSTEM ENDPOINTS
// POST /api/quotes/:id/offer - Seller submits a unique rate/bid
router.post('/:id/offer', quoteController.submitSellerOffer.bind(quoteController));

// POST /api/quotes/:id/accept - Buyer accepts a specific seller's offer
router.post('/:id/accept', quoteController.acceptSellerOffer.bind(quoteController));

// POST /api/quotes/:id/pay - Mark quote as paid and move to Processing
router.post('/:id/pay', quoteController.markAsPaid.bind(quoteController));

// 4. GENERAL UPDATE
// PUT /api/quotes/:id - Update quote (General updates)
router.put('/:id', quoteController.updateQuote.bind(quoteController));

// PATCH /api/quotes/:id/status - Update order status (for tracking)
router.patch('/:id/status', quoteController.updateQuote.bind(quoteController));

module.exports = router;