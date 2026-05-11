const express = require('express');
const router = express.Router();
const { getReturns, createReturn } = require('../controllers/returnController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getReturns).post(createReturn);

module.exports = router;
