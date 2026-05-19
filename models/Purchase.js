import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    productName: String,
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    costPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    totalPrice: {
        type: Number,
        required: true,
    }
});

const purchaseSchema = new mongoose.Schema(
    {
        purchaseNumber: {
            type: String,
            required: true,
            unique: true,
        },
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier",
            required: true,
        },
        items: [purchaseItemSchema],
        subtotal: {
            type: Number,
            required: true,
            default: 0,
        },
        tax: {
            type: Number,
            default: 0,
        },
        total: {
            type: Number,
            required: true,
            default: 0,
        },
        paidAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ["ordered", "received", "cancelled"],
            default: "received",
        },
        notes: String,
        totalItems: {
            type: Number,
            default: 0,
        },
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

export const Purchase = mongoose.model("Purchase", purchaseSchema);
