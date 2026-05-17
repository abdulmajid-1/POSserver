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
        },

        totalPaid: {
            type: Number,
            default: 0,
            min: 0,
        },

        remainingBalance: {
            type: Number,
            default: 0,
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
supplierSchema.pre("save", function () {
    this.totalPurchases = this.totalPurchases || 0;
    this.totalPaid = this.totalPaid || 0;

    this.remainingBalance =
        this.totalPurchases - this.totalPaid;
});

supplierSchema.statics.getSupplierStats = async function (supplierId) {
    const result = await this.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(supplierId),
            },
        },

        {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "supplier",
                as: "products",
            },
        },

        {
            $addFields: {
                totalProductsSupplied: {
                    $sum: "$products.quantity",
                },
            },
        },

        {
            $project: {
                name: 1,
                company: 1,
                phone: 1,
                email: 1,

                totalPurchases: 1,
                totalPaid: 1,
                remainingBalance: 1,

                totalProductsSupplied: 1,
            },
        },
    ]);

    return result[0];
};
export const Supplier = mongoose.model(
    "Supplier",
    supplierSchema
);