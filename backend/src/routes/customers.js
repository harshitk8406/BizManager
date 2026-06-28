const express = require('express');
const router = express.Router();
const { getCustomers, getCustomerById, getCustomerByGST, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');

router.get('/', getCustomers);
router.post('/', createCustomer);
router.get('/gst/:gst', getCustomerByGST);
router.get('/:id', getCustomerById);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
