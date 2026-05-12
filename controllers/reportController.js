import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Return from '../models/Return.js';
import Product from '../models/Product.js';

const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const sales = await Sale.find(match).sort({ createdAt: -1 });
    const [totals] = await Sale.aggregate([{ $match: match }, { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 }, discount: { $sum: '$discount' }, tax: { $sum: '$tax' } } }]);
    const byDay = await Sale.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    res.json({ success: true, sales, totals: totals || { revenue: 0, count: 0, discount: 0, tax: 0 }, byDay });
  } catch (error) { next(error); }
};

const getExpenseReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const expenses = await Expense.find(match).sort({ date: -1 });
    const [totals] = await Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const byCategory = await Expense.aggregate([{ $match: match }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]);
    res.json({ success: true, expenses, totals: totals || { total: 0 }, byCategory });
  } catch (error) { next(error); }
};

const getProfitReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateMatch = {};
    if (startDate || endDate) {
      dateMatch.createdAt = {};
      if (startDate) dateMatch.createdAt.$gte = new Date(startDate);
      if (endDate) dateMatch.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const expMatch = startDate || endDate ? { date: dateMatch.createdAt } : {};
    const [salesTotals] = await Sale.aggregate([{ $match: dateMatch }, { $group: { _id: null, revenue: { $sum: '$total' } } }]);
    const [expenseTotals] = await Expense.aggregate([{ $match: expMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const [returnTotals] = await Return.aggregate([{ $match: dateMatch }, { $group: { _id: null, total: { $sum: '$totalRefund' } } }]);
    const revenue = salesTotals?.revenue || 0;
    const expenses = expenseTotals?.total || 0;
    const returns = returnTotals?.total || 0;
    res.json({ success: true, data: { revenue, expenses, returns, grossProfit: revenue - returns, netProfit: revenue - returns - expenses } });
  } catch (error) { next(error); }
};

const getInventoryReport = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ quantity: 1 });
    const [totals] = await Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, totalProducts: { $sum: 1 }, totalStockValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } }, totalSaleValue: { $sum: { $multiply: ['$quantity', '$salePrice'] } } } }]);
    const byCategory = await Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', count: { $sum: 1 }, totalQty: { $sum: '$quantity' } } }]);
    res.json({ success: true, products, totals: totals || { totalProducts: 0, totalStockValue: 0, totalSaleValue: 0 }, byCategory });
  } catch (error) { next(error); }
};

module.exports = { getSalesReport, getExpenseReport, getProfitReport, getInventoryReport };
