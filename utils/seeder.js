import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({
      email: "admin@abtraders.com",
    });

    if (existing) {
      console.log("ℹAdmin user already exists. Skipping seed.");
      process.exit(0);
    }

    await User.create({
      name: "Admin",
      email: "admin@abtraders.com",
      password: "Admin@1234",
      role: "admin",
      storeName: "AB Traders",
    });

    console.log("✅ Admin user seeded successfully!");
    console.log("   Email   : admin@abtraders.com");
    console.log("   Password: Admin@1234");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    process.exit(1);
  }
};

seedAdmin();