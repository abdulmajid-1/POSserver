import { Purchase } from '../models/Purchase.js';
import { Supplier } from '../models/Supplier.js';
import { Product } from '../models/Product.js';
import { generatePurchaseNumber } from '../utils/generateInvoiceNumber.js';
import { round4 } from '../utils/mathUtils.js';

export const createPurchase = async (req, res, next) => {
    try {
        const { supplierId, items, subtotal, tax, total, paidAmount, notes, totalItems, date } = req.body;

        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        const purchaseNumber = await generatePurchaseNumber();

        const purchase = await Purchase.create({
            purchaseNumber,
            supplier: supplierId,
            items: (items || []).map((i) => ({
              ...i,
              costPrice: round4(i.costPrice),
              totalPrice: round4(i.totalPrice),
            })),
            subtotal: round4(subtotal),
            tax: round4(tax),
            total: round4(total),
            paidAmount: round4(paidAmount || 0),
            notes,
            totalItems,
            date: date || new Date(),
            createdBy: req.user._id,
        });

        // Update Supplier Financials
        supplier.totalPurchases = round4(supplier.totalPurchases + round4(total));
        await supplier.save();

        // Update Product Stock
        for (const item of items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { quantity: item.quantity },
                $set: { purchasePrice: item.costPrice } // Update purchase price to the latest one
            });
        }

        res.status(201).json({ success: true, purchase });
    } catch (error) {
        next(error);
    }
};

export const getPurchases = async (req, res, next) => {
    try {
        const { supplierId, page = 1, limit = 20 } = req.query;
        const query = {};
        if (supplierId) query.supplier = supplierId;

        const skip = (page - 1) * limit;
        const purchases = await Purchase.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('supplier', 'name company');

        const total = await Purchase.countDocuments(query);

        res.json({
            success: true,
            purchases,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page)
        });
    } catch (error) {
        next(error);
    }
};

export const getPurchaseById = async (req, res, next) => {
    try {
        const purchase = await Purchase.findById(req.params.id)
            .populate('supplier', 'name company phone email address')
            .populate('items.product', 'name sku');

        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }
        res.json({ success: true, purchase });
    } catch (error) {
        next(error);
    }
};

export const updatePurchase = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { items, subtotal, tax, total, notes, totalItems, date, status } = req.body;

        const purchase = await Purchase.findById(id);
        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }

        const supplier = await Supplier.findById(purchase.supplier);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        // Revert old purchase from supplier & products
        supplier.totalPurchases -= purchase.total;

        for (const oldItem of purchase.items) {
            await Product.findByIdAndUpdate(oldItem.product, {
                $inc: { quantity: -oldItem.quantity }
            });
        }

        // Apply new purchase to supplier & products
        supplier.totalPurchases += total;
        await supplier.save();

        for (const newItem of items) {
            await Product.findByIdAndUpdate(newItem.product, {
                $inc: { quantity: newItem.quantity },
                $set: { purchasePrice: newItem.costPrice || newItem.unitPrice }
            });
        }

        // Update purchase document
        purchase.items = items;
        purchase.subtotal = subtotal;
        purchase.tax = tax;
        purchase.total = total;
        purchase.notes = notes;
        purchase.totalItems = totalItems;
        if (date) purchase.date = date;
        if (status) purchase.status = status;

        await purchase.save();

        res.json({ success: true, purchase });
    } catch (error) {
        next(error);
    }
};

export const deletePurchase = async (req, res, next) => {
    try {
        const purchase = await Purchase.findById(req.params.id);
        if (!purchase) {
            return res.status(404).json({ success: false, message: 'Purchase not found' });
        }

        const supplier = await Supplier.findById(purchase.supplier);
        if (supplier) {
            supplier.totalPurchases -= purchase.total;
            await supplier.save();
        }

        for (const item of purchase.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { quantity: -item.quantity }
            });
        }

        await purchase.deleteOne();

        res.json({ success: true, message: 'Purchase deleted successfully' });
    } catch (error) {
        next(error);
    }
};
