import { Product } from '../models/Product.js';
import { ProductCategory } from "../models/ProductCategory.js";
import { Supplier } from "../models/Supplier.js";


// @desc    Get all products
// @route   GET /api/products

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      supplier,
      page = 1,
      limit = 50,
      lowStock,
    } = req.query;

    const query = { isActive: true };

    // SEARCH
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { sku: { $regex: safeSearch, $options: "i" } },
      ];
    }

    // CATEGORY FILTER
    if (category) {
      query.category = category;
    }

    // SUPPLIER FILTER
    if (supplier) {
      query.supplier = supplier;
    }

    // LOW STOCK FILTER — applied inside the DB query so pagination is correct
    if (lowStock === "true") {
      query.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("supplier", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    const categories = await ProductCategory.find({
      isActive: true,
    });

    const suppliers = await Supplier.find({
      isActive: true,
    });

    res.json({
      success: true,
      products,
      total,
      categories,
      suppliers,
    });
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
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted permanently' });

  } catch (error) {
    next(error);
  }
};
export { getProducts, getLowStockProducts, getProduct, createProduct, updateProduct, deleteProduct };
