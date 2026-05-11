const express = require('express');
const router = express.Router();
const { getSalesReport, getExpenseReport, getProfitReport, getInventoryReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/sales', getSalesReport);
router.get('/expenses', getExpenseReport);
router.get('/profit', getProfitReport);
router.get('/inventory', getInventoryReport);

module.exports = router;
