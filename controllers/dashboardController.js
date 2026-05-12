import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import Product from '../models/Product.js';
import Return from '../models/Return.js';

const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const [salesData] = await Sale.aggregate([{ $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]);
    const [monthSales] = await Sale.aggregate([{ $match: { createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]);
    const [todaySales] = await Sale.aggregate([{ $match: { createdAt: { $gte: startOfToday } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]);
    const [expenseData] = await Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    const [monthExpense] = await Expense.aggregate([{ $match: { date: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    const [returnsData] = await Return.aggregate([{ $group: { _id: null, total: { $sum: '$totalRefund' }, count: { $sum: 1 } } }]);

    const productCount = await Product.countDocuments({ isActive: true });
    const allProducts = await Product.find({ isActive: true });
    const lowStockProducts = allProducts.filter((p) => p.quantity <= p.lowStockThreshold);

    const recentSales = await Sale.find().sort({ createdAt: -1 }).limit(5);

    const totalRevenue = salesData?.total || 0;
    const totalExpenses = expenseData?.total || 0;
    const totalProfit = totalRevenue - totalExpenses - (returnsData?.total || 0);

    res.json({
      success: true,
      stats: {
        totalSales: salesData?.count || 0,
        totalRevenue,
        totalExpenses,
        totalProfit,
        totalReturns: returnsData?.count || 0,
        totalReturnAmount: returnsData?.total || 0,
        productCount,
        lowStockCount: lowStockProducts.length,
        monthSales: { count: monthSales?.count || 0, total: monthSales?.total || 0 },
        todaySales: { count: todaySales?.count || 0, total: todaySales?.total || 0 },
        monthExpenses: monthExpense?.total || 0,
      },
      lowStockProducts: lowStockProducts.slice(0, 5),
      recentSales,
    });
  } catch (error) { next(error); }
};

export default { getDashboardStats };
