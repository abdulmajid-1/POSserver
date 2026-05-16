import express from "express";

import {
    createSale,
    getSales,
    getSale,
    updateSale,
    getDailySummary,
    getWeeklyData,
    getMonthlyData,
} from "../controllers/saleController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/summary/daily", getDailySummary);
router.get("/summary/weekly", getWeeklyData);
router.get("/summary/monthly", getMonthlyData);

router.route("/").get(getSales).post(createSale);

router.route("/:id").get(getSale).put(updateSale);

export default router;