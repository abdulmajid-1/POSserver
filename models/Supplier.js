import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
    {
        // Basic Info
        name: {
            type: String,
            required: [true, "Supplier name is required"],
            trim: true,
        },

        company: {
            type: String,
            trim: true,
            default: "",
        },

        phone: {
            type: String,
            trim: true,
            default: "",
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: "",
        },

        address: {
            type: String,
            default: "",
        },

        // Financial Info
        totalPurchases: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalPaid: {
            type: Number,
            default: 0,
            min: 0,
        },

        remainingBalance: {
            type: Number,
            default: 0,
            min: 0,
        },

        totalProductsSupplied: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Optional Details
        notes: {
            type: String,
            default: "",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Auto calculate remaining balance
supplierSchema.pre("save", function (next) {
    this.totalPurchases = this.totalPurchases || 0;
    this.totalPaid = this.totalPaid || 0;

    this.remainingBalance =
        this.totalPurchases - this.totalPaid;
});
export const Supplier = mongoose.model(
    "Supplier",
    supplierSchema
);