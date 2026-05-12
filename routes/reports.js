import express from "express";

import {
    getSalesReport,
    getExpenseReport,
    getProfitReport,
    getInventoryReport,
} from "../controllers/reportController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/sales", getSalesReport);
router.get("/expenses", getExpenseReport);
router.get("/profit", getProfitReport);
router.get("/inventory", getInventoryReport);

export default router;