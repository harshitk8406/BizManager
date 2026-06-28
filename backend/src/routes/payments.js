const express = require('express');
const router = express.Router();
const {
  getPayments,
  getPaymentSummary,
  getPartyBalances,
  createPayment,
  updatePayment,
  deletePayment
} = require('../controllers/paymentController');

router.get('/', getPayments);
router.get('/summary', getPaymentSummary);
router.get('/balances', getPartyBalances);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

module.exports = router;
