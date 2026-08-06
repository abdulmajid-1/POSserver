import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false,
  },

  productName: { type: String, required: true },
  sku: { type: String },

  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },

  // Multi-unit system
  selectedUnit: { type: String, default: '' },
  conversionFactor: { type: Number, default: 1 },

  // 🔥 IMPORTANT: store purchase price at time of sale
  purchasePrice: { type: Number, default: 0 },

  // 💰 calculated profit per item
  profit: { type: Number, default: 0 },

  discount: { type: Number, default: 0 },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'fixed',
  },

  totalPrice: { type: Number, required: true },

  returnedQuantity: { type: Number, default: 0, min: 0 },

  isCustomItem: { type: Boolean, default: false },
});

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      index: true,
    },

    items: [saleItemSchema],

    customer: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
      name: { type: String, default: 'Walk-in Customer' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      vatNumber: { type: String, default: '' },
    },

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed',
    },

    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },

    total: { type: Number, required: true },

    // 💰 total profit of whole sale
    totalProfit: { type: Number, default: 0 },

    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'other'],
      default: 'cash',
    },

    notes: { type: String, default: '' },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    status: {
      type: String,
      enum: ['completed', 'refunded', 'partial_refund'],
      default: 'completed',
    },

    // 🧾 ZATCA Phase 2 E-Invoicing Data
    zatca: {
      icv: { type: Number },
      invoiceSerialNumber: { type: String },
      invoiceUUID: { type: String },        // UUID embedded in the signed XML
      invoiceType: {                        // B2C (Simplified) | B2B (Standard/Clearance)
        type: String,
        enum: ['B2C', 'B2B'],
      },
      pih: { type: String },
      invoiceHash: { type: String },
      digitalSignature: { type: String },   // ECDSA signature (base64 DER)
      qrCode: { type: String },
      signedXml: { type: String },          // XML we signed locally
      clearedXml: { type: String },         // B2B only — ZATCA-stamped XML returned from clearance
      reportingStatus: {
        type: String,
        enum: ['NOT_REPORTED', 'REPORTED', 'CLEARED', 'FAILED', 'PENDING'],
        default: 'NOT_REPORTED',
      },
      clearanceStatus: { type: String },    // Raw clearance status from ZATCA (B2B)
      validationResults: { type: Object },
      submittedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export const Sale = mongoose.model('Sale', saleSchema);