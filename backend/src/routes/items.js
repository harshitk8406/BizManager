const express = require('express');
const router = express.Router();
const { getItems, getItemByCode, createItem, updateItem, deleteItem } = require('../controllers/itemController');

router.get('/', getItems);
router.post('/', createItem);
router.get('/:code', getItemByCode);
router.put('/:code', updateItem);
router.delete('/:code', deleteItem);

module.exports = router;
