// routes/sellerRoutes.js
const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');

// POST /api/sellers - Create a new seller (admin only)
router.post('/', sellerController.createSeller.bind(sellerController));

// GET /api/sellers - Get all sellers
router.get('/', sellerController.getAllSellers.bind(sellerController));

// GET /api/sellers/:id - Get seller by ID
router.get('/:id', sellerController.getSellerById.bind(sellerController));

module.exports = router;

