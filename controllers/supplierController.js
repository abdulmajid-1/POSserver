import { Supplier } from "../models/Supplier.js";

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
export const getSupplier = async (req, res, next) => {
    try {
        const supplier = await Supplier.findById(req.params.id);

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
        const { paidAmount } = req.body;

        const supplier = await Supplier.findById(req.params.id);

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found",
            });
        }

        supplier.totalPaid += Number(paidAmount || 0);

        await supplier.save(); // triggers remainingBalance auto calc

        res.status(200).json({
            success: true,
            message: "Payment updated",
            data: supplier,
        });
    } catch (error) {
        next(error);
    }
};