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
    editSupplierPayment,
    deleteSupplierPayment
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

// Direct Payment operations
router.put("/payments/:paymentId", editSupplierPayment);
router.delete("/payments/:paymentId", deleteSupplierPayment);

export default router;