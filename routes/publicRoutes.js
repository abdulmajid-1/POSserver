import express from "express";
import rateLimit from "express-rate-limit";
import { Sale } from "../models/Sale.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Aggressive rate limiting on all public endpoints
// - 30 requests per 15 minutes per IP (a customer scanning a QR)
// - Prevents brute-force enumeration of sale IDs
// ─────────────────────────────────────────────────────────────────────────────
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                   // max 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

router.use(publicLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Whitelist of ONLY the fields a customer should ever see.
// Everything else (profit, purchasePrice, createdBy, internal IDs) is stripped.
// We manually construct the response object — never return raw DB documents.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize a sale document into a safe, customer-facing receipt.
 * Uses WHITELIST approach — only explicitly listed fields are included.
 */
function sanitizeReceipt(sale) {
  return {
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    status: sale.status,

    // Customer info — only public customer details (name, phone, vatNumber)
    customer: {
      name: sale.customer?.name || "Walk-in Customer",
      phone: sale.customer?.phone || "",
      vatNumber: sale.customer?.vatNumber || "",
    },

    // Items — only what appears on a printed receipt
    items: (sale.items || []).map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      selectedUnit: item.selectedUnit || "",
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      discountType: item.discountType || "fixed",
      totalPrice: item.totalPrice,
    })),

    // Totals
    subtotal: sale.subtotal,
    discount: sale.discount || 0,
    discountType: sale.discountType || "fixed",
    tax: sale.tax || 0,
    taxRate: sale.taxRate || 0,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/receipt/:id
// Public endpoint — NO authentication required
// Returns sanitized receipt data for a given sale ID
// ─────────────────────────────────────────────────────────────────────────────
router.get("/receipt/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // SECURITY: Validate ObjectId format to prevent injection/NoSQL attacks
    if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    // Fetch ONLY the fields we need — never fetch sensitive fields from DB
    const sale = await Sale.findById(id).select(
      "invoiceNumber createdAt status customer.name customer.phone customer.vatNumber items.productName items.quantity items.selectedUnit items.unitPrice items.discount items.discountType items.totalPrice subtotal discount discountType tax taxRate total paymentMethod"
    );

    if (!sale) {
      // SECURITY: Generic "not found" — don't reveal whether ID exists
      return res.status(404).json({
        success: false,
        message: "Receipt not found",
      });
    }

    // SECURITY: Return sanitized data only — double-protection via whitelist
    const receipt = sanitizeReceipt(sale);

    res.json({ success: true, receipt });
  } catch (error) {
    // SECURITY: Never leak error details to public endpoints
    console.error("Public receipt error:", error.message);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
});

export default router;
