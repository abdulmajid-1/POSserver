const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require("./db/index.js");
const errorHandler = require('./middleware/errorHandler.js');


dotenv.config({
    path: "./.env",
});
// Initialize database connection and start server
// This ensures database is ready before accepting requests
connectDB()
    .then(() => {
        // Start the Express server once database connection is established
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        // Handle database connection errors
        console.log("MongoDB connection error:", err);
    });

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/products', require('./routes/products.js'));
app.use('/api/sales', require('./routes/sales.js'));
app.use('/api/expenses', require('./routes/expenses.js'));
app.use('/api/returns', require('./routes/returns.js'));
app.use('/api/dashboard', require('./routes/dashboard.js'));
app.use('/api/reports', require('./routes/reports.js'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'AB Traders API running' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` AB Traders server running on http://localhost:${PORT}`));
