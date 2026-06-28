const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, checkUsername } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/check-username', checkUsername);

module.exports = router;
