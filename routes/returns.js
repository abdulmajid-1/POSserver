import express from "express";

import {
    getReturns,
    createReturn,
} from "../controllers/returnController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route("/").get(getReturns).post(createReturn);

export default router;