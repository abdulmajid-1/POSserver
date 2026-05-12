import { ProductCategory } from "../models/ProductCategory.js";

// @desc    Create new category
// @route   POST /api/categories
export const createCategory = async (req, res, next) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res
                .status(400)
                .json({ success: false, message: "Category name is required" });
        }

        const existing = await ProductCategory.findOne({ name });

        if (existing) {
            return res
                .status(400)
                .json({ success: false, message: "Category already exists" });
        }

        const category = await ProductCategory.create({
            name,
            description,
        });

        res.status(201).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all categories
// @route   GET /api/categories
export const getCategories = async (req, res, next) => {
    try {
        const categories = await ProductCategory.find({ isActive: true }).sort({
            name: 1,
        });

        res.status(200).json({
            success: true,
            count: categories.length,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
export const deleteCategory = async (req, res, next) => {
    try {
        const category = await ProductCategory.findById(req.params.id);

        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: "Category not found" });
        }

        await category.deleteOne();

        res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

