// routes/buyerRoutes.js
const express = require('express');
const router = express.Router();
const buyerController = require('../controllers/buyerController');

// POST /api/buyers/register - Register a new buyer
router.post('/register', buyerController.register.bind(buyerController));

// GET /api/buyers/:id - Get buyer by ID
router.get('/:id', buyerController.getBuyerById.bind(buyerController));

module.exports = router;

