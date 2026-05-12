import express from "express";
import {
    login,
    getProfile,
    updateProfile,
    changePassword,
} from "../controllers/authController.js";

import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;