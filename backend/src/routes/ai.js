const express = require('express');
const router = express.Router();
const { aiChat, aiHsnSuggest, aiAnomalyCheck, aiReportSummary, aiPaymentReminder } = require('../controllers/aiController');

router.post('/chat',             aiChat);
router.post('/hsn-suggest',      aiHsnSuggest);
router.post('/anomaly-check',    aiAnomalyCheck);
router.post('/report-summary',   aiReportSummary);
router.post('/payment-reminder', aiPaymentReminder);

module.exports = router;
