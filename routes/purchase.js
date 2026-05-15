import express from 'express';
import { createPurchase, getPurchases, getPurchaseById } from '../controllers/purchaseController.js';
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getPurchases)
    .post(createPurchase);

router.route('/:id')
    .get(getPurchaseById);

export default router;
