const express = require('express');
const router = express.Router();
const { getProducts, getLowStockProducts, getProduct, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/low-stock', getLowStockProducts);
router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProduct).put(updateProduct).delete(deleteProduct);

module.exports = router;
