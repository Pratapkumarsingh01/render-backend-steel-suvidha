// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// --- Specific POST Routes ---

// POST /api/products - Create a new product (Admin or Seller)
router.post('/', productController.createProduct.bind(productController));

// NEW: POST /api/products/toggle-master - Seller activating/inactivating an Admin product
// This MUST stay above /:id routes to avoid conflict
router.post('/toggle-master', productController.toggleMasterProduct.bind(productController));

// POST /api/products/seed-master-catalog - Seed master catalog with all product combinations
router.post('/seed-master-catalog', productController.seedMasterCatalog.bind(productController));


// --- Specific GET Routes ---

// GET /api/products - Get all products (supports query params: isMaster, category, etc.)
router.get('/', productController.getAllProducts.bind(productController));

// GET /api/products/seller/:sellerId - Get products by seller
// This MUST stay above /:id routes
router.get('/seller/:sellerId', productController.getProductsBySeller.bind(productController));


// --- Dynamic ID Routes (Place these at the bottom) ---

// GET /api/products/:id - Get product by ID
router.get('/:id', productController.getProductById.bind(productController));

// PUT /api/products/:id - Update product
router.put('/:id', productController.updateProduct.bind(productController));

// DELETE /api/products/:id - Delete product
router.delete('/:id', productController.deleteProduct.bind(productController));

module.exports = router;