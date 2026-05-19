
import { Sale } from '../models/Sale.js';
import { Expense } from '../models/Expense.js';
import { Return } from '../models/Return.js';
import { Product } from '../models/Product.js';

const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const match = {};

    if (startDate || endDate) {
      match.createdAt = {};

      if (startDate) {
        match.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length === 10) end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const sales = await Sale.find(match).sort({ createdAt: -1 });

    // 💰 TOTALS (NOW INCLUDING REVENUE)
    const [totals] = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$total' },      // ✅ TOTAL SALES ADDED
          profit: { $sum: '$totalProfit' },
          count: { $sum: 1 },
          discount: { $sum: '$discount' },
          tax: { $sum: '$tax' },
        },
      },
    ]);

    // 📊 PROFIT BY DAY
    const byDay = await Sale.aggregate([
      { $match: match },

      { $unwind: "$items" },

      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          profit: { $sum: '$items.profit' },
          count: { $sum: 1 },
        },
      },

      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,

      data: {
        revenue: totals?.revenue || 0,
        totalProfit: totals?.profit || 0,
        count: totals?.count || 0,
        discount: totals?.discount || 0,
        tax: totals?.tax || 0,
      },

      byDay,
    });

  } catch (error) {
    next(error);
  }
};

const getExpenseReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const match = {};

    if (startDate || endDate) {
      match.date = {};

      if (startDate) match.date.$gte = new Date(startDate);

      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length === 10) end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const expenses = await Expense.find(match).sort({ date: -1 });

    const [totals] = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const byCategory = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({
      success: true,
      expenses,
      totals: totals || { total: 0 },
      byCategory,
    });
  } catch (error) {
    next(error);
  }
};

const getProfitReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const dateMatch = {};

    if (startDate || endDate) {
      dateMatch.createdAt = {};

      if (startDate) dateMatch.createdAt.$gte = new Date(startDate);

      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length === 10) end.setHours(23, 59, 59, 999);
        dateMatch.createdAt.$lte = end;
      }
    }

    const expMatch =
      startDate || endDate
        ? { date: dateMatch.createdAt }
        : {};

    // =========================
    // 💰 SALES PROFIT
    // =========================
    const [salesTotals] = await Sale.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          profit: { $sum: '$totalProfit' },
          revenue: { $sum: '$total' } // ✅ ADD THIS
        }
      }
    ]);

    // =========================
    // 💸 EXPENSES
    // =========================
    const [expenseTotals] = await Expense.aggregate([
      { $match: expMatch },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // =========================
    // 🔁 RETURNS
    // =========================
    const [returnTotals] = await Return.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalRefund' },
          totalRefundedProfit: { $sum: '$totalRefundedProfit' }
        }
      }
    ]);

    const profit = salesTotals?.profit || 0;
    const revenue = salesTotals?.revenue || 0; // ✅ NEW
    const expenses = expenseTotals?.total || 0;
    const returns = returnTotals?.total || 0;
    const returnedProfit = returnTotals?.totalRefundedProfit || 0;

    const grossProfit = profit - returnedProfit;
    const netProfit = grossProfit - expenses;

    res.json({
      success: true,
      data: {
        revenue,       // ✅ TOTAL SALES
        profit,
        expenses,
        returns,
        grossProfit,
        netProfit
      }
    });

  } catch (error) {
    next(error);
  }
};


const getInventoryReport = async (req, res, next) => {
  try {
    // 📦 ALL PRODUCTS
    const products = await Product.find({ isActive: true })
      .populate('category', 'name')
      .sort({ quantity: 1 });

    // 📊 TOTALS
    const [totals] = await Product.aggregate([
      { $match: { isActive: true } },

      {
        $group: {
          _id: null,

          totalProducts: { $sum: 1 },

          totalStockValue: {
            $sum: {
              $multiply: ['$quantity', '$purchasePrice'],
            },
          },

          totalSaleValue: {
            $sum: {
              $multiply: ['$quantity', '$salePrice'],
            },
          },
        },
      },
    ]);

    // 📂 CATEGORY REPORT WITH CATEGORY NAME
    const byCategory = await Product.aggregate([
      { $match: { isActive: true } },

      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQty: { $sum: '$quantity' },
        },
      },

      {
        $lookup: {
          from: 'productcategories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },

      {
        $unwind: '$category',
      },

      {
        $project: {
          _id: 0,
          categoryId: '$category._id',
          categoryName: '$category.name',
          count: 1,
          totalQty: 1,
        },
      },
    ]);

    res.json({
      success: true,

      products,

      totals: totals || {
        totalProducts: 0,
        totalStockValue: 0,
        totalSaleValue: 0,
      },

      byCategory,
    });

  } catch (error) {
    next(error);
  }
};

export {
  getSalesReport,
  getExpenseReport,
  getProfitReport,
  getInventoryReport,
};