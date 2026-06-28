const jwt = require('jsonwebtoken');
const { asyncHandler, createError } = require('./errorHandler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_123');
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      throw createError('Not authorized, token failed', 401);
    }
  }
  if (!token) {
    throw createError('Not authorized, no token', 401);
  }
});

module.exports = { protect };
