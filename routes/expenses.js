import express from "express";
import {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
} from "../controllers/expenseController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

/* =========================================
   PROTECT ALL ROUTES
========================================= */
router.use(protect);

/* =========================================
   MAIN ROUTES
========================================= */

// GET all expenses + CREATE expense
router
    .route("/")
    .get(getExpenses)
    .post(createExpense);

// UPDATE + DELETE expense by ID
router
    .route("/:id")
    .put(updateExpense)
    .delete(deleteExpense);

export default router;