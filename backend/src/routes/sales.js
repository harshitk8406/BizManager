const express = require('express');
const router = express.Router();
const { getSales, getSaleById, createSale, updateSale, deleteSale, getNextInvoiceNumber } = require('../controllers/saleController');

router.get('/', getSales);
router.post('/', createSale);
router.get('/next-invoice-number', getNextInvoiceNumber);
router.get('/:id', getSaleById);
router.put('/:id', updateSale);
router.delete('/:id', deleteSale);

module.exports = router;
