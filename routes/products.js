import express from "express";

import {
    getProducts,
    getLowStockProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../controllers/productController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/low-stock", getLowStockProducts);

router.route("/").get(getProducts).post(createProduct);

router
    .route("/:id")
    .get(getProduct)
    .put(updateProduct)
    .delete(deleteProduct);

export default router;