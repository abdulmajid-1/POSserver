import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
/**
 * Connect to MongoDB database
 * Establishes connection to MongoDB using mongoose
 * @returns {Promise<void>}
 */
const connectDB = async () => {
    try {
        // Log the database name being used
        console.log(`Database name: ${DB_NAME}`);

        // Establish connection to MongoDB using mongoose
        // Uses MONGODB_URI from environment variables and appends database name
        const connectionInstance = await mongoose.connect(
            `${process.env.MONGODB_URI}/${DB_NAME}`
        );

        // Log successful connection with host information
        console.log(
            `MongoDB connected successfully. Host: ${connectionInstance.connection.host}`
        );
    } catch (error) {
        // Handle connection errors
        console.log("MongoDB connection error:", error);
        // Exit process with error code 1 if database connection fails
        process.exit(1);
    }
};

export { connectDB };
