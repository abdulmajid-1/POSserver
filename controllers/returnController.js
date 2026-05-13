import { Return } from '../models/Return.js';
import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { generateReturnNumber } from '../utils/generateInvoiceNumber.js';

const getReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const returns = await Return.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('originalSale', 'invoiceNumber total');
    const total = await Return.countDocuments();
    res.json({ success: true, returns, total });
  } catch (error) { next(error); }
};

const createReturn = async (req, res, next) => {
  try {
    const { saleId, items, reason } = req.body;
    const sale = await Sale.findById(saleId);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    const returnItems = [];
    let totalRefund = 0;

    for (const item of items) {
      const saleItem = sale.items.find((si) => si.product.toString() === item.productId);
      if (!saleItem) return res.status(400).json({ success: false, message: 'Item not found in original sale' });
      if (item.quantity > saleItem.quantity) return res.status(400).json({ success: false, message: 'Return qty exceeds purchased qty' });
      const refund = saleItem.unitPrice * item.quantity;
      totalRefund += refund;
      returnItems.push({ product: saleItem.product, productName: saleItem.productName, quantity: item.quantity, unitPrice: saleItem.unitPrice, totalRefund: refund });
      await Product.findByIdAndUpdate(saleItem.product, { $inc: { quantity: item.quantity } });
    }

    const newReturn = await Return.create({
      returnNumber: await generateReturnNumber(),
      originalSale: sale._id,
      invoiceNumber: sale.invoiceNumber,
      items: returnItems,
      totalRefund,
      reason,
      createdBy: req.user._id,
    });
    sale.status = 'refunded';
    await sale.save();
    res.status(201).json({ success: true, return: newReturn });
  } catch (error) { next(error); }
};

export { getReturns, createReturn };
