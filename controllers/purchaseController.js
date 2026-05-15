import { Purchase } from '../models/Purchase.js';
import { Supplier } from '../models/Supplier.js';
import { Product } from '../models/Product.js';
import { generatePurchaseNumber } from '../utils/generateInvoiceNumber.js';

export const createPurchase = async (req, res, next) => {
    try {
        const { supplierId, items, subtotal, tax, total, notes, totalItems, date } = req.body;

        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }

        const purchaseNumber = await generatePurchaseNumber();

        const purchase = await Purchase.create({
            purchaseNumber,
            supplier: supplierId,
            items: items || [],
            subtotal,
            tax,
            total,
            notes,
            totalItems,
            date: date || new Date(),
            createdBy: req.user._id,
        });

        // Update Supplier Financials
        supplier.totalPurchases += total;
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
