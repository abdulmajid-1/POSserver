import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import { generateInvoiceNumber } from '../utils/generateInvoiceNumber.js';

// @desc    Create a new sale
// @route   POST /api/sales
const createSale = async (req, res, next) => {
  try {
    const { items, customer, discount, discountType, taxRate, paymentMethod, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in sale' });
    }

    // Validate stock and build items
    const saleItems = [];
    let subtotal = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
      if (product.quantity < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for: ${product.name}` });
      }
      const itemTotal = product.salePrice * item.quantity;
      subtotal += itemTotal;
      saleItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: product.salePrice,
        totalPrice: itemTotal,
      });
      // Deduct stock
      product.quantity -= item.quantity;
      await product.save();
    }

    // Calculate totals
    let discountAmount = 0;
    if (discount && discount > 0) {
      discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    }
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxRate ? (taxableAmount * taxRate) / 100 : 0;
    const total = taxableAmount + taxAmount;

    const invoiceNumber = generateInvoiceNumber('INV');
    const sale = await Sale.create({
      invoiceNumber,
      items: saleItems,
      customer: customer || { name: 'Walk-in Customer' },
      subtotal,
      discount: discountAmount,
      discountType: discountType || 'fixed',
      tax: taxAmount,
      taxRate: taxRate || 0,
      total,
      paymentMethod: paymentMethod || 'cash',
      notes,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, sale });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sales
// @route   GET /api/sales
const getSales = async (req, res, next) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const sales = await Sale.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Sale.countDocuments(query);
    res.json({ success: true, sales, total, page: Number(page) });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('items.product', 'name sku image');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, sale });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily sales summary
// @route   GET /api/sales/summary/daily
const getDailySummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [result] = await Sale.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, totalSales: { $sum: 1 }, totalRevenue: { $sum: '$total' } } },
    ]);
    res.json({ success: true, data: result || { totalSales: 0, totalRevenue: 0 } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly chart data (last 7 days)
// @route   GET /api/sales/summary/weekly
const getWeeklyData = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly chart data
// @route   GET /api/sales/summary/monthly
const getMonthlyData = async (req, res, next) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          sales: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = data.map((d) => ({ month: months[d._id - 1], sales: d.sales, revenue: d.revenue }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};

module.exports = { createSale, getSales, getSale, getDailySummary, getWeeklyData, getMonthlyData };
