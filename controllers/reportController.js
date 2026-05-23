
import { Sale } from '../models/Sale.js';
import { Expense } from '../models/Expense.js';
import { Return } from '../models/Return.js';
import { Product } from '../models/Product.js';

/* ─────────────────────────────────────────
   Helper: Build date match object
   ───────────────────────────────────────── */
const buildDateMatch = (field, startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const match = { [field]: {} };
  if (startDate) match[field].$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    // If only a date string was sent (no time), push to end-of-day
    if (endDate.length === 10) end.setHours(23, 59, 59, 999);
    match[field].$lte = end;
  }
  return match;
};

/* ─────────────────────────────────────────
   Sales Report
   ───────────────────────────────────────── */
const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = buildDateMatch('createdAt', startDate, endDate);

    // ── Totals (single aggregation, no full document fetch) ──
    const [totals] = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue:  { $sum: '$total' },
          profit:   { $sum: '$totalProfit' },
          count:    { $sum: 1 },
          discount: { $sum: '$discount' },
          tax:      { $sum: '$tax' },
        },
      },
    ]);

    // ── Per-day breakdown (for chart) ──
    const byDay = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          profit:  { $sum: '$totalProfit' },
          count:   { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        revenue:      totals?.revenue  || 0,
        totalProfit:  totals?.profit   || 0,
        count:        totals?.count    || 0,
        discount:     totals?.discount || 0,
        tax:          totals?.tax      || 0,
      },
      byDay,
    });
  } catch (error) {
    next(error);
  }
};

/* ─────────────────────────────────────────
   Expense Report
   ───────────────────────────────────────── */
const getExpenseReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    // Expenses use the field 'date', not 'createdAt'
    const match = buildDateMatch('date', startDate, endDate);

    const [totals] = await Expense.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const byCategory = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id:   '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      success: true,
      totals: totals || { total: 0 },
      byCategory,
    });
  } catch (error) {
    next(error);
  }
};

/* ─────────────────────────────────────────
   Profit Report
   ───────────────────────────────────────── */
const getProfitReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Sales use 'createdAt', expenses use 'date' – build each separately
    const saleMatch    = buildDateMatch('createdAt', startDate, endDate);
    const expenseMatch = buildDateMatch('date',      startDate, endDate);
    const returnMatch  = buildDateMatch('createdAt', startDate, endDate);

    const [salesTotals] = await Sale.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id:     null,
          profit:  { $sum: '$totalProfit' },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    const [expenseTotals] = await Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const [returnTotals] = await Return.aggregate([
      { $match: returnMatch },
      {
        $group: {
          _id:                 null,
          total:               { $sum: '$totalRefund' },
          totalRefundedProfit: { $sum: '$totalRefundedProfit' },
        },
      },
    ]);

    const profit          = salesTotals?.profit              || 0;
    const revenue         = salesTotals?.revenue             || 0;
    const expenses        = expenseTotals?.total             || 0;
    const returns         = returnTotals?.total              || 0;
    const returnedProfit  = returnTotals?.totalRefundedProfit || 0;

    const grossProfit = profit - returnedProfit;
    const netProfit   = grossProfit - expenses;

    res.json({
      success: true,
      data: { revenue, profit, expenses, returns, grossProfit, netProfit },
    });
  } catch (error) {
    next(error);
  }
};

/* ─────────────────────────────────────────
   Inventory Report
   ───────────────────────────────────────── */
const getInventoryReport = async (req, res, next) => {
  try {
    // Lean projection — don't return heavy embedded arrays
    const products = await Product.find({ isActive: true })
      .populate('category', 'name')
      .select('name sku quantity purchasePrice salePrice lowStockThreshold category')
      .sort({ quantity: 1 })
      .lean();

    const [totals] = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id:            null,
          totalProducts:  { $sum: 1 },
          totalStockValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } },
          totalSaleValue:  { $sum: { $multiply: ['$quantity', '$salePrice']    } },
        },
      },
    ]);

    const byCategory = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 }, totalQty: { $sum: '$quantity' } } },
      { $lookup: { from: 'productcategories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      { $project: { _id: 0, categoryId: '$category._id', categoryName: '$category.name', count: 1, totalQty: 1 } },
    ]);

    res.json({
      success: true,
      products,
      totals: totals || { totalProducts: 0, totalStockValue: 0, totalSaleValue: 0 },
      byCategory,
    });
  } catch (error) {
    next(error);
  }
};

export { getSalesReport, getExpenseReport, getProfitReport, getInventoryReport };