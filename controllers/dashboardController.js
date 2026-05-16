// import { Sale } from '../models/Sale.js';
// import { Expense } from '../models/Expense.js';
// import { Product } from '../models/Product.js';
// import { Return } from '../models/Return.js';

// const getDashboardStats = async (req, res, next) => {
//   try {
//     const { startDate, endDate } = req.query;

//     // Filter conditions for the range
//     const rangeFilter = {};
//     const dateFilter = {}; // for Expense model which uses 'date' field

//     if (startDate || endDate) {
//       rangeFilter.createdAt = {};
//       dateFilter.date = {};
//       if (startDate) {
//         // If it's a full ISO string from frontend, use it. If it's just a date, it will be UTC midnight.
//         rangeFilter.createdAt.$gte = new Date(startDate);
//         dateFilter.date.$gte = new Date(startDate);
//       }
//       if (endDate) {
//         const end = new Date(endDate);
//         // Only set hours if it's a date-only string (length 10)
//         if (endDate.length === 10) {
//           end.setHours(23, 59, 59, 999);
//         }
//         rangeFilter.createdAt.$lte = end;
//         dateFilter.date.$lte = end;
//       }
//     }

//     // Range-specific data
//     const [rangeSales] = await Sale.aggregate([
//       { $match: rangeFilter },
//       { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
//     ]);

//     const [rangeExpense] = await Expense.aggregate([
//       { $match: dateFilter },
//       { $group: { _id: null, total: { $sum: '$amount' } } }
//     ]);

//     const [rangeReturns] = await Return.aggregate([
//       { $match: rangeFilter },
//       { $group: { _id: null, total: { $sum: '$totalRefund' }, count: { $sum: 1 } } }
//     ]);

//     // Global data (not range specific)
//     const productCount = await Product.countDocuments({ isActive: true });
//     const lowStockProducts = await Product.find({ 
//       isActive: true,
//       $expr: { $lte: ["$quantity", "$lowStockThreshold"] } 
//     }).limit(5);
//     const lowStockCount = await Product.countDocuments({
//       isActive: true,
//       $expr: { $lte: ["$quantity", "$lowStockThreshold"] } 
//     });

//     const recentSales = await Sale.find().sort({ createdAt: -1 }).limit(5);

//     const revenue = rangeSales?.total || 0;
//     const expenses = rangeExpense?.total || 0;
//     const returns = rangeReturns?.total || 0;
//     const profit = revenue - expenses - returns;

//     res.json({
//       success: true,
//       stats: {
//         rangeSales: { count: rangeSales?.count || 0, total: revenue },
//         rangeExpenses: expenses,
//         rangeReturns: { count: rangeReturns?.count || 0, total: returns },
//         rangeProfit: profit,
//         productCount,
//         lowStockCount,
//       },
//       lowStockProducts,
//       recentSales,
//     });
//   } catch (error) { next(error); }
// };

// export { getDashboardStats };


import { Sale } from '../models/Sale.js';
import { Expense } from '../models/Expense.js';
import { Product } from '../models/Product.js';
import { Return } from '../models/Return.js';

const getDashboardStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // =========================
    // 📅 DATE FILTERS
    // =========================
    const rangeFilter = {};
    const dateFilter = {};

    if (startDate || endDate) {
      rangeFilter.createdAt = {};
      dateFilter.date = {};

      if (startDate) {
        rangeFilter.createdAt.$gte = new Date(startDate);
        dateFilter.date.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);

        if (endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }

        rangeFilter.createdAt.$lte = end;
        dateFilter.date.$lte = end;
      }
    }

    // =========================
    // 💰 SALES + PROFIT
    // =========================
    const [rangeSales] = await Sale.aggregate([
      { $match: rangeFilter },

      {
        $group: {
          _id: null,

          revenue: { $sum: '$total' },

          totalProfit: { $sum: '$totalProfit' },

          count: { $sum: 1 },
        },
      },
    ]);

    // =========================
    // 💸 EXPENSES
    // =========================
    const [rangeExpense] = await Expense.aggregate([
      { $match: dateFilter },

      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // =========================
    // 🔁 RETURNS
    // =========================
    const [rangeReturns] = await Return.aggregate([
      { $match: rangeFilter },

      {
        $group: {
          _id: null,
          total: { $sum: '$totalRefund' },
          count: { $sum: 1 },
        },
      },
    ]);

    // =========================
    // 📦 PRODUCTS
    // =========================
    const productCount = await Product.countDocuments({
      isActive: true,
    });

    const lowStockProducts = await Product.find({
      isActive: true,

      $expr: {
        $lte: ['$quantity', '$lowStockThreshold'],
      },
    })
      .populate('category', 'name')
      .sort({ quantity: 1 })
      .limit(5);

    const lowStockCount = await Product.countDocuments({
      isActive: true,

      $expr: {
        $lte: ['$quantity', '$lowStockThreshold'],
      },
    });

    // =========================
    // 🧾 RECENT SALES
    // =========================
    const recentSales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // =========================
    // 📊 FINAL CALCULATIONS
    // =========================
    const revenue = rangeSales?.revenue || 0;

    const salesProfit = rangeSales?.totalProfit || 0;

    const expenses = rangeExpense?.total || 0;

    const returns = rangeReturns?.total || 0;

    // REAL BUSINESS PROFIT
    const netProfit = salesProfit - expenses - returns;

    // =========================
    // 🚀 RESPONSE
    // =========================
    res.json({
      success: true,

      stats: {
        rangeSales: {
          count: rangeSales?.count || 0,
          revenue,
          totalProfit: salesProfit,
        },

        rangeExpenses: expenses,

        rangeReturns: {
          count: rangeReturns?.count || 0,
          total: returns,
        },

        rangeProfit: netProfit,

        productCount,

        lowStockCount,
      },

      lowStockProducts,

      recentSales,
    });

  } catch (error) {
    next(error);
  }
};

export { getDashboardStats };