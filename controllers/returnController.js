import { Return } from '../models/Return.js';
import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { generateReturnNumber } from '../utils/generateInvoiceNumber.js';
import { calculateSaleStatus } from '../utils/saleStatus.js';

const getReturns = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, phone } = req.query;
    const query = {};
    if (phone) query['customer.phone'] = phone;

    const returns = await Return.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('originalSale', 'invoiceNumber total');
    const total = await Return.countDocuments(query);
    res.json({ success: true, returns, total });
  } catch (error) { next(error); }
};


const createReturn = async (req, res, next) => {
  try {
    const { saleId, items, reason } = req.body;

    const sale = await Sale.findById(saleId);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const returnItems = [];
    let totalRefund = 0;
    let totalRefundedProfit = 0;

    // 🔥 STEP 1: Get previous returns for this sale
    const previousReturns = await Return.find({ originalSale: saleId });

    // 🔥 STEP 2: Calculate already returned quantities
    const returnedMap = new Map();

    previousReturns.forEach((r) => {
      r.items.forEach((i) => {
        const key = i.product?.toString();
        returnedMap.set(
          key,
          (returnedMap.get(key) || 0) + i.returnQuantity
        );
      });
    });

    // 🔥 STEP 3: Process new return items
    for (const item of items) {
      const saleItem = sale.items.find(
        (si) => si.product?.toString() === item.productId
      );

      if (!saleItem) {
        return res.status(400).json({
          success: false,
          message: 'Item not found in original sale',
        });
      }

      if (item.quantity > saleItem.quantity - (saleItem.returnedQuantity || 0)) {
        return res.status(400).json({
          success: false,
          message: 'Return qty exceeds remaining quantity',
        });
      }

      // ✅ THIS is the key part (UPDATE HERE)
      saleItem.returnedQuantity =
        (saleItem.returnedQuantity || 0) + item.quantity;

      // Calculate refund inclusive of tax
      const baseRefund = saleItem.unitPrice * item.quantity;
      const taxAmount = (baseRefund * (sale.taxRate || 0)) / 100;
      const refund = baseRefund + taxAmount;

      // Calculate profit to reverse
      const profitPerItem = (saleItem.profit || 0) / saleItem.quantity;
      const refundedProfit = profitPerItem * item.quantity;

      totalRefund += refund;
      totalRefundedProfit += refundedProfit;

      returnItems.push({
        product: saleItem.product,
        productName: saleItem.productName,
        originalQuantity: saleItem.quantity,
        returnQuantity: item.quantity,
        selectedUnit: saleItem.selectedUnit || '',
        conversionFactor: Number(saleItem.conversionFactor) || 1,
        unitPrice: saleItem.unitPrice,
        totalRefund: refund,
        refundedProfit: refundedProfit
      });

      const factor = Number(saleItem.conversionFactor) || 1;
      const baseQtyToRestore = parseFloat((item.quantity / factor).toFixed(4));

      await Product.findByIdAndUpdate(saleItem.product, {
        $inc: { quantity: baseQtyToRestore },
      });
    }

    // 🔥 STEP 4: Determine sale status
    const allItemsReturned = sale.items.every((si) => {
      const returned = returnedMap.get(si.product?.toString()) || 0;
      return returned + si.quantity === si.quantity;
    });

    const newReturn = await Return.create({
      returnNumber: await generateReturnNumber(),
      originalSale: sale._id,
      invoiceNumber: sale.invoiceNumber,
      items: returnItems,
      customer: sale.customer || { name: 'Walk-in Customer' },
      totalRefund,
      totalRefundedProfit,
      reason,
      createdBy: req.user._id,
    });

    sale.status = calculateSaleStatus(sale);
    await sale.save();

    // Update customer stats for returns
    if (sale.customer && sale.customer.phone) {
      await Customer.findOneAndUpdate(
        { phone: sale.customer.phone, isActive: true },
        {
          $inc: {
            totalReturns: 1,
            totalRefunded: totalRefund,
          },
        }
      );
    }

    return res.status(201).json({
      success: true,
      return: newReturn,
    });

  } catch (error) {
    next(error);
  }
};



export {
  createReturn,
  getReturns
}



