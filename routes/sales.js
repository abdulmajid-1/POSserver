const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale, getDailySummary, getWeeklyData, getMonthlyData } = require('../controllers/saleController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/summary/daily', getDailySummary);
router.get('/summary/weekly', getWeeklyData);
router.get('/summary/monthly', getMonthlyData);
router.route('/').get(getSales).post(createSale);
router.route('/:id').get(getSale);

module.exports = router;
