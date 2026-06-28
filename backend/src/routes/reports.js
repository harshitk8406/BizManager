const express = require('express');
const router = express.Router();
const { getStockSummary, getStockDetail, getSalesDetail, getGSTR1, getGSTR3B, getDashboardStats } = require('../controllers/reportController');

router.get('/stock-summary',  getStockSummary);
router.get('/stock-detail',   getStockDetail);
router.get('/sales-detail',   getSalesDetail);
router.get('/gstr1',          getGSTR1);
router.get('/gstr3b',         getGSTR3B);
router.get('/dashboard',      getDashboardStats);

module.exports = router;
