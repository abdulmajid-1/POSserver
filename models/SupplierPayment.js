import mongoose from "mongoose";

const supplierPaymentSchema = new mongoose.Schema(
    {
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier",
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentMethod: {
            type: String,
            enum: ["cash", "card", "bank_transfer", "check", "other"],
            default: "cash",
        },
        referenceNumber: String,
        notes: String,
        date: {
            type: Date,
            default: Date.now,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

export const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);
