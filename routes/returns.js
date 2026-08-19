import express from "express";

import {
    getReturns,
    createReturn,
    getReturn,
    reportCreditNoteToZatcaController,
} from "../controllers/returnController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/:id/report-zatca", reportCreditNoteToZatcaController);
router.route("/").get(getReturns).post(createReturn);
router.route("/:id").get(getReturn);

export default router;