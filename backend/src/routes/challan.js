const express = require('express');
const router = express.Router();
const {
  getChallans,
  getChallanById,
  getNextChallanNumber,
  createChallan,
  updateChallan,
  deleteChallan,
  convertToInvoice,
} = require('../controllers/challanController');

router.get('/',                    getChallans);
router.post('/',                   createChallan);
router.get('/next-number',         getNextChallanNumber);
router.get('/:id',                 getChallanById);
router.put('/:id',                 updateChallan);
router.delete('/:id',              deleteChallan);
router.post('/:id/convert',        convertToInvoice);

module.exports = router;
