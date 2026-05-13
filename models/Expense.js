import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    // Basic Info
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
    },

    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },

    // Category for reporting & filtering
    category: {
      type: String,
      required: false,
      default: 'Other',
    },

    // 🔥 Universal type (makes system scalable)
    type: {
      type: String,
      enum: ['EXPENSE', 'INCOME'],
      default: 'EXPENSE',
    },

    // 🔥 Generic reference system (VERY IMPORTANT)
    // Allows linking expense to ANY model (Supplier, Employee, Sale, etc.)
    referenceModel: {
      type: String, // e.g. "Supplier", "Employee", "Sale"
      default: null,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Date of expense
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Optional notes
    notes: {
      type: String,
      default: '',
    },

    // Who created this expense
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   INDEXES (performance boost)
========================= */
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ referenceModel: 1, referenceId: 1 });
expenseSchema.index({ type: 1, date: -1 });

/* =========================
   MODEL
========================= */
export const Expense = mongoose.model('Expense', expenseSchema);