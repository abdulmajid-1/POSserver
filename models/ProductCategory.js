import mongoose from "mongoose";

const productCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            trim: true,
            unique: true,
        },

        description: {
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

export const ProductCategory = mongoose.model(
    "ProductCategory",
    productCategorySchema
);