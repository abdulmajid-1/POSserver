import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },

  originalQuantity: { type: Number, required: true, min: 1 },
  returnQuantity: { type: Number, required: true, min: 1 },

  selectedUnit: { type: String, default: '' },
  conversionFactor: { type: Number, default: 1 },

  unitPrice: { type: Number, required: true },
  totalRefund: { type: Number, required: true },
  refundedProfit: { type: Number, default: 0 },
});

const returnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    originalSale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },

    items: [returnItemSchema],

    customer: {
      name: { type: String, default: 'Walk-in Customer' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      vatNumber: { type: String, default: '' },
    },

    totalRefund: {
      type: Number,
      required: true,
      min: 0,
    },

    totalRefundedProfit: {
      type: Number,
      default: 0,
    },

    reason: {
      type: String,
      required: [true, 'Reason is required'],
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

export const Return = mongoose.model('Return', returnSchema);