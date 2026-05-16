import { Supplier } from "../models/Supplier.js";
import { SupplierPayment } from "../models/SupplierPayment.js";

// @desc    Create Supplier
// @route   POST /api/suppliers
export const createSupplier = async (req, res, next) => {
    try {
        const {
            name,
            company,
            phone,
            email,
            address,
            totalPurchases,
            totalPaid,
            notes,
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required",
            });
        }

        const existing = await Supplier.findOne({ name });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Supplier already exists",
            });
        }

        const supplier = await Supplier.create({
            name,
            company,
            phone,
            email,
            address,
            totalPurchases: totalPurchases || 0,
            totalPaid: totalPaid || 0,
            notes,
        });

        res.status(201).json({
            success: true,
            data: supplier,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all suppliers
// @route   GET /api/suppliers
export const getSuppliers = async (req, res, next) => {
    try {
        const suppliers = await Supplier.find({ isActive: true }).sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            count: suppliers.length,
            data: suppliers,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// export const getSupplier = async (req, res, next) => {
//     try {
//         const supplier = await Supplier.findById(req.params.id);

//         if (!supplier) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Supplier not found",
//             });
//         }

//         res.status(200).json({
//             success: true,
//             data: supplier,
//         });
//     } catch (error) {
//         next(error);
//     }
// };

export const getSupplier = async (req, res, next) => {
    try {

        const supplier = await Supplier.getSupplierStats(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found",
            });
        }

        res.status(200).json({
            success: true,
            data: supplier,
        });

    } catch (error) {
        next(error);
    }
};


// @desc    Add supplier purchase
// @route   PATCH /api/suppliers/:id/purchase
export const addSupplierPurchase = async (req, res, next) => {
    try {
        const { purchaseAmount, paidAmount } = req.body;

        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found",
            });
        }

        supplier.totalPurchases += Number(purchaseAmount || 0);

        supplier.totalPaid += Number(paidAmount || 0);

        supplier.remainingBalance =
            supplier.totalPurchases - supplier.totalPaid;

        await supplier.save();

        res.status(200).json({
            success: true,
            message: "Purchase added successfully",
            data: supplier,
        });
    } catch (error) {
        next(error);
    }
};


// @desc    Update supplier
// @route   PUT /api/suppliers/:id
export const updateSupplier = async (req, res, next) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found",
            });
        }

        const updated = await Supplier.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete supplier (soft delete)
// @route   DELETE /api/suppliers/:id
export const deleteSupplier = async (req, res, next) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found",
            });
        }

        supplier.isActive = false;
        await supplier.save();

        res.status(200).json({
            success: true,
            message: "Supplier deactivated successfully",
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update supplier payment (very useful for POS)
// @route   PATCH /api/suppliers/:id/payment
export const updateSupplierPayment = async (req, res, next) => {
    try {
        const { amount, paymentMethod, referenceNumber, notes, date } = req.body;

        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found",
            });
        }

        // Create Payment Record
        const payment = await SupplierPayment.create({
            supplier: supplier._id,
            amount: Number(amount),
            paymentMethod,
            referenceNumber,
            notes,
            date: date || new Date(),
            createdBy: req.user?._id
        });

        supplier.totalPaid += Number(amount || 0);
        await supplier.save(); // triggers remainingBalance auto calc

        res.status(200).json({
            success: true,
            message: "Payment updated",
            data: supplier,
            payment
        });
    } catch (error) {
        next(error);
    }
};

export const getSupplierPayments = async (req, res, next) => {
    try {
        const payments = await SupplierPayment.find({ supplier: req.params.id })
            .sort({ date: -1 });

        res.json({ success: true, count: payments.length, data: payments });
    } catch (error) {
        next(error);
    }
};

export const editSupplierPayment = async (req, res, next) => {
    try {
        const { paymentId } = req.params;
        const { amount, paymentMethod, referenceNumber, notes, date } = req.body;

        const payment = await SupplierPayment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        const supplier = await Supplier.findById(payment.supplier);
        if (!supplier) {
            return res.status(404).json({ success: false, message: "Supplier not found" });
        }

        const diff = Number(amount) - payment.amount;
        supplier.totalPaid += diff;
        await supplier.save();

        payment.amount = Number(amount);
        payment.paymentMethod = paymentMethod;
        payment.referenceNumber = referenceNumber;
        payment.notes = notes;
        if (date) payment.date = date;

        await payment.save();

        res.status(200).json({ success: true, payment });
    } catch (error) {
        next(error);
    }
};

export const deleteSupplierPayment = async (req, res, next) => {
    try {
        const { paymentId } = req.params;

        const payment = await SupplierPayment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        const supplier = await Supplier.findById(payment.supplier);
        if (supplier) {
            supplier.totalPaid -= payment.amount;
            await supplier.save();
        }

        await payment.deleteOne();

        res.status(200).json({ success: true, message: "Payment deleted" });
    } catch (error) {
        next(error);
    }
};