const express = require('express');
const router = express.Router();
const { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase, getNextInvoiceNumber } = require('../controllers/purchaseController');

router.get('/', getPurchases);
router.post('/', createPurchase);
router.get('/next-invoice-number', getNextInvoiceNumber);
router.get('/:id', getPurchaseById);
router.put('/:id', updatePurchase);
router.delete('/:id', deletePurchase);

module.exports = router;
