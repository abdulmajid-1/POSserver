import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalRefund: { type: Number, required: true },
});

const returnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true },
    originalSale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    invoiceNumber: { type: String, required: true },
    items: [returnItemSchema],
    totalRefund: { type: Number, required: true },
    reason: { type: String, required: [true, 'Reason is required'] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Return', returnSchema);
