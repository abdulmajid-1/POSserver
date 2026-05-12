import express from "express";
import {
    createCategory,
    getCategories,
    deleteCategory,
} from "../controllers/productCategoryController.js";

const router = express.Router();

router.post("/", createCategory);
router.get("/", getCategories);
router.delete("/:id", deleteCategory);

export default router;