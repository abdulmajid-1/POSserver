import Product from '../models/Product.js';

// @desc    Get all products
// @route   GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 50, lowStock } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (category) query.category = category;

    let products = await Product.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    if (lowStock === 'true') products = products.filter((p) => p.quantity <= p.lowStockThreshold);

    const total = await Product.countDocuments(query);
    const categories = await Product.distinct('category');
    res.json({ success: true, products, total, categories });
  } catch (error) {
    next(error);
  }
};

// @desc    Get low stock products
// @route   GET /api/products/low-stock
const getLowStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true });
    const lowStock = products.filter((p) => p.quantity <= p.lowStockThreshold);
    res.json({ success: true, products: lowStock, count: lowStock.length });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProducts, getLowStockProducts, getProduct, createProduct, updateProduct, deleteProduct };
