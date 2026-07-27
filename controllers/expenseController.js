import { Expense } from '../models/Expense.js';

/* =========================================
   GET ALL EXPENSES (with filters + pagination)
========================================= */
// @route   GET /api/expenses
const getExpenses = async (req, res, next) => {
  try {
    const {
      search,
      category,
      type,
      referenceModel,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    /* -------------------------
       TEXT SEARCH
    -------------------------- */
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    /* -------------------------
       FILTERS
    -------------------------- */
    if (category) query.category = category;
    if (type) query.type = type;
    if (referenceModel) query.referenceModel = referenceModel;

    /* -------------------------
       DATE FILTER
    -------------------------- */
    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        query.date.$gte = new Date(startDate);
      }

      if (endDate) {
        query.date.$lte = new Date(
          new Date(endDate).setHours(23, 59, 59, 999)
        );
      }
    }

    /* -------------------------
       PAGINATION
    -------------------------- */
    const skip = (Number(page) - 1) * Number(limit);

    const expenses = await Expense.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('createdBy', 'name email');

    const total = await Expense.countDocuments(query);

    /* -------------------------
       TOTAL AMOUNT (FILTERED)
    -------------------------- */
    const aggregateResult = await Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const totalAmount = aggregateResult?.[0]?.totalAmount || 0;

    /* -------------------------
       RESPONSE
    -------------------------- */
    res.json({
      success: true,
      expenses,
      total,
      page: Number(page),
      limit: Number(limit),
      totalAmount,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================
   CREATE EXPENSE
========================================= */
// @route   POST /api/expenses
const createExpense = async (req, res, next) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      createdBy: req.user?._id || null,
    });

    res.status(201).json({
      success: true,
      expense,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================
   UPDATE EXPENSE
========================================= */
// @route   PUT /api/expenses/:id
const updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }

    res.json({
      success: true,
      expense,
    });
  } catch (error) {
    next(error);
  }
};

/* =========================================
   DELETE EXPENSE
========================================= */
// @route   DELETE /api/expenses/:id
const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found',
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
};