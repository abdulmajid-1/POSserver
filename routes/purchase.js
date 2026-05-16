import express from 'express';
import { createPurchase, getPurchases, getPurchaseById, updatePurchase, deletePurchase } from '../controllers/purchaseController.js';
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getPurchases)
    .post(createPurchase);

router.route('/:id')
    .get(getPurchaseById)
    .put(updatePurchase)
    .delete(deletePurchase);

export default router;
