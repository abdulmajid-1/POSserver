import express from "express";
import {
    createSupplier,
    getSuppliers,
    getSupplier,
    updateSupplier,
    deleteSupplier,
    updateSupplierPayment,
    addSupplierPurchase,
    getSupplierPayments,
} from "../controllers/supplierController.js";

const router = express.Router();

router.post("/", createSupplier);
router.get("/", getSuppliers);
router.get("/:id", getSupplier);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);
router.patch("/:id/payment", updateSupplierPayment);
router.get("/:id/payments", getSupplierPayments);
router.patch("/:id/purchase", addSupplierPurchase);

export default router;