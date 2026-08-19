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
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
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

    // 🧾 ZATCA Phase 2 E-Invoicing Data (Credit Note)
    wasZatcaReported: { type: Boolean, default: false },
    originalZatcaInvoiceNumber: { type: String, default: '' },

    zatca: {
      icv: { type: Number },
      invoiceSerialNumber: { type: String },
      invoiceUUID: { type: String },
      invoiceType: {
        type: String,
        enum: ['B2C', 'B2B'],
      },
      pih: { type: String },
      invoiceHash: { type: String },
      digitalSignature: { type: String },
      qrCode: { type: String },
      signedXml: { type: String },
      clearedXml: { type: String },
      reportingStatus: {
        type: String,
        enum: ['NOT_REPORTED', 'REPORTED', 'CLEARED', 'FAILED', 'PENDING'],
        default: 'NOT_REPORTED',
      },
      clearanceStatus: { type: String },
      validationResults: { type: Object },
      submittedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export const Return = mongoose.model('Return', returnSchema);