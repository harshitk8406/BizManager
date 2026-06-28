const express = require('express');
const router = express.Router();
const { getMyFirms, createFirm, updateFirm } = require('../controllers/firmController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getMyFirms);
router.post('/', createFirm);
router.put('/:id', updateFirm);

module.exports = router;
