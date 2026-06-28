const express = require('express');
const router = express.Router();
const { getSuppliers, getSupplierById, getSupplierByGST, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');

router.get('/', getSuppliers);
router.post('/', createSupplier);
router.get('/gst/:gst', getSupplierByGST);
router.get('/:id', getSupplierById);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

module.exports = router;
