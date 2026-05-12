import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Expense title is required'], trim: true },
    amount: { type: Number, required: [true, 'Amount is required'], min: 0 },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Supplies', 'Maintenance', 'Transport', 'Other'],
      default: 'Other',
    },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Expense', expenseSchema);
