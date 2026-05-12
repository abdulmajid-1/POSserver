import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    sku: { type: String, required: [true, 'SKU is required'], unique: true, trim: true, uppercase: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory",
      required: [true, "Category is required"],
    },
    purchasePrice: { type: Number, required: [true, 'Purchase price is required'], min: 0 },
    salePrice: { type: Number, required: [true, 'Sale price is required'], min: 0 },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: false,
    }, image: { type: String, default: '' },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.lowStockThreshold;
});

productSchema.virtual('profitMargin').get(function () {
  if (this.purchasePrice === 0) return 0;
  return (((this.salePrice - this.purchasePrice) / this.purchasePrice) * 100).toFixed(2);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export const Product = mongoose.model('Product', productSchema);
