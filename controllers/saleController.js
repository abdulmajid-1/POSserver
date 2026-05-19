import { Sale } from '../models/Sale.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { generateInvoiceNumber } from '../utils/generateInvoiceNumber.js';

// @desc    Create a new sale
// @route   POST /api/sales
const createSale = async (req, res, next) => {
  try {
    const { items, customer, discount, discountType, taxRate, paymentMethod, notes } = req.body;
    // Allow empty items array for blank invoices
    const saleItems = [];
    let subtotal = 0;
    let totalProfit = 0;

    if (items && items.length > 0) {
      for (const item of items) {
        let product = null;
        let productName = item.productName;
        let sku = item.sku;
        let unitPrice = Number(item.unitPrice) || 0;

        if (item.productId && !item.productId.startsWith('custom-')) {
          product = await Product.findById(item.productId);
          if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });

          const conversionFactor = Number(item.conversionFactor) || 1;
          const baseQtyToDeduct = parseFloat((item.quantity / conversionFactor).toFixed(4));
          
          if (product.quantity < baseQtyToDeduct) {
            return res.status(400).json({ success: false, message: `Insufficient stock for: ${product.name}` });
          }

          productName = product.name;
          sku = product.sku;
          unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : product.salePrice;

          product.quantity = parseFloat((product.quantity - baseQtyToDeduct).toFixed(4));
          await product.save();
        }

        const basePrice = unitPrice * item.quantity;
        let itemDiscountAmount = 0;
        if (item.discount && item.discount > 0) {
          itemDiscountAmount = item.discountType === 'percentage'
            ? (basePrice * item.discount) / 100
            : item.discount;
        }
        const itemTotal = basePrice - itemDiscountAmount;

        const purchasePrice = product ? product.purchasePrice : (Number(item.purchasePrice) || 0);
        const conversionFactor = Number(item.conversionFactor) || 1;
        const baseQty = parseFloat((item.quantity / conversionFactor).toFixed(4));

        // profit for this item
        const itemProfit = itemTotal - (purchasePrice * baseQty);
        totalProfit += itemProfit;


        subtotal += itemTotal;
        saleItems.push({
          product: product ? product._id : null,
          productName: productName,
          sku: sku || '',
          quantity: item.quantity,
          selectedUnit: item.selectedUnit || '',
          conversionFactor: Number(item.conversionFactor) || 1,
          profit: itemProfit,
          unitPrice: unitPrice,
          purchasePrice: purchasePrice,
          discount: item.discount || 0,
          discountType: item.discountType || 'fixed',
          totalPrice: itemTotal,
          isCustomItem: !product
        });
      }
    }

    // Calculate totals
    let discountAmount = 0;
    if (discount && discount > 0) {
      discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    }
    const taxAmount = taxRate ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal + taxAmount - discountAmount;

    const invoiceNumber = await generateInvoiceNumber('INV');
    const sale = await Sale.create({
      invoiceNumber,
      items: saleItems,
      customer: customer || { name: 'Walk-in Customer' },
      subtotal,
      discount: discountAmount,
      discountType: discountType || 'fixed',
      tax: taxAmount,
      taxRate: taxRate || 0,
      total,
      paymentMethod: paymentMethod || 'cash',
      notes,
      createdBy: req.user._id,
      totalProfit: totalProfit - discountAmount
    });

    // Update customer stats if it's an existing customer
    if (customer && customer.phone) {
      await Customer.findOneAndUpdate(
        { phone: customer.phone, isActive: true },
        {
          $inc: {
            totalPurchases: 1,
            totalSpent: total
          }
        }
      );
    }

    res.status(201).json({ success: true, sale });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a sale
// @route   PUT /api/sales/:id
const updateSale = async (req, res, next) => {
  try {
    const { items, customer, discount, discountType, taxRate, paymentMethod, notes } = req.body;

    const oldSale = await Sale.findById(req.params.id);
    if (!oldSale) return res.status(404).json({ success: false, message: 'Sale not found' });

    // 1. Revert old stock changes
    for (const item of oldSale.items) {
      if (item.product) {
        const factor = Number(item.conversionFactor) || 1;
        const baseQty = parseFloat((item.quantity / factor).toFixed(4));
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: baseQty }
        });
      }
    }

    // 2. Build new sale items
    const saleItems = [];
    let subtotal = 0;
    let totalProfit = 0; // ✅ NEW

    for (const item of items) {
      let product = null;
      let productName = item.productName;
      let sku = item.sku;
      let unitPrice = Number(item.unitPrice) || 0;

      if (item.productId && !item.productId.startsWith('custom-')) {
        product = await Product.findById(item.productId);

        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${item.productId}`
          });
        }

        // Deduct new stock
        const conversionFactor = Number(item.conversionFactor) || 1;
        const baseQtyToDeduct = parseFloat((item.quantity / conversionFactor).toFixed(4));

        if (product.quantity < baseQtyToDeduct) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for: ${product.name}`
          });
        }

        productName = product.name;
        sku = product.sku;
        unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : product.salePrice;

        product.quantity = parseFloat((product.quantity - baseQtyToDeduct).toFixed(4));
        await product.save();
      }

      const basePrice = unitPrice * item.quantity;

      let itemDiscountAmount = 0;
      if (item.discount && item.discount > 0) {
        itemDiscountAmount =
          item.discountType === 'percentage'
            ? (basePrice * item.discount) / 100
            : item.discount;
      }

      const itemTotal = basePrice - itemDiscountAmount;

      // =========================
      // ✅ PROFIT CALCULATION
      // =========================
      const purchasePrice = product ? product.purchasePrice : (Number(item.purchasePrice) || 0);
      const conversionFactor = Number(item.conversionFactor) || 1;
      const baseQty = parseFloat((item.quantity / conversionFactor).toFixed(4));
      
      const itemProfit = itemTotal - (purchasePrice * baseQty);

      subtotal += itemTotal;
      totalProfit += itemProfit;

      saleItems.push({
        product: product ? product._id : null,
        productName,
        sku: sku || '',
        quantity: item.quantity,
        selectedUnit: item.selectedUnit || '',
        conversionFactor: conversionFactor,
        unitPrice,
        purchasePrice: purchasePrice,
        discount: item.discount || 0,
        discountType: item.discountType || 'fixed',
        totalPrice: itemTotal,
        profit: itemProfit, // ✅ NEW FIELD
        isCustomItem: !product
      });
    }

    // 3. Recalculate totals
    let discountAmount = 0;
    if (discount && discount > 0) {
      discountAmount =
        discountType === 'percentage'
          ? (subtotal * discount) / 100
          : discount;
    }

    const taxAmount = taxRate ? (subtotal * taxRate) / 100 : 0;
    const total = subtotal + taxAmount - discountAmount;

    // 4. Update customer stats
    if (oldSale.customer && oldSale.customer.phone) {
      await Customer.findOneAndUpdate(
        { phone: oldSale.customer.phone },
        {
          $inc: {
            totalSpent: -oldSale.total,
            totalPurchases: -1
          }
        }
      );
    }

    if (customer && customer.phone) {
      await Customer.findOneAndUpdate(
        { phone: customer.phone },
        {
          $inc: {
            totalSpent: total,
            totalPurchases: 1
          }
        }
      );
    }

    // 5. Update Sale document
    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      {
        items: saleItems,
        customer: customer || { name: 'Walk-in Customer' },
        subtotal,
        discount: discountAmount,
        discountType: discountType || 'fixed',
        tax: taxAmount,
        taxRate: taxRate || 0,
        total,

        // ✅ IMPORTANT
        totalProfit: totalProfit - discountAmount,

        paymentMethod: paymentMethod || 'cash',
        notes
      },
      { new: true }
    );

    res.json({ success: true, sale: updatedSale });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sales
// @route   GET /api/sales
const getSales = async (req, res, next) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const sales = await Sale.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Sale.countDocuments(query);
    res.json({ success: true, sales, total, page: Number(page) });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('items.product', 'name sku image');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, sale });
  } catch (error) {
    next(error);
  }
};

// @desc    Get daily sales summary
// @route   GET /api/sales/summary/daily
const getDailySummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [result] = await Sale.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, totalSales: { $sum: 1 }, totalRevenue: { $sum: '$total' } } },
    ]);
    res.json({ success: true, data: result || { totalSales: 0, totalRevenue: 0 } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly chart data (last 7 days)
// @route   GET /api/sales/summary/weekly
const getWeeklyData = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly chart data
// @route   GET /api/sales/summary/monthly
const getMonthlyData = async (req, res, next) => {
  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const data = await Sale.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          sales: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatted = data.map((d) => ({ month: months[d._id - 1], sales: d.sales, revenue: d.revenue }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
};
const calculateSaleStatus = (sale) => {
  let totalSold = 0;
  let totalReturned = 0;

  sale.items.forEach((item) => {
    totalSold += item.quantity;
    totalReturned += item.returnedQuantity || 0;
  });

  if (totalReturned === 0) return 'completed';
  if (totalReturned < totalSold) return 'partial_refund';
  return 'refunded';
};

export { createSale, getSales, getSale, getDailySummary, getWeeklyData, getMonthlyData, calculateSaleStatus, updateSale };
