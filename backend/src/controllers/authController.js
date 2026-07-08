const User = require('../models/User');
const Firm = require('../models/Firm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret_key_123', { expiresIn: '30d' });
};

const register = asyncHandler(async (req, res) => {
  const { 
    name, username, password,
    firmName, address, pincode, gstin, phone, email, state, stateCode 
  } = req.body;

  if (!name || !username || !password) {
    throw createError('Please provide name, username and password', 400);
  }
  if (!firmName || !address) {
    throw createError('Please provide firm name and address', 400);
  }

  const cleanUsername = username.trim();
  const escapedUsername = cleanUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const existing = await User.findOne({ username: { $regex: new RegExp('^' + escapedUsername + '$', 'i') } });
  if (existing) throw createError('Username is already taken', 400);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({ name, username: cleanUsername.toLowerCase(), password: hashedPassword, firms: [] });

  // Create initial firm for the user
  const firm = await Firm.create({
    name: firmName,
    address,
    pincode: pincode || '',
    gstin: gstin || '',
    phone: phone || '',
    email: email || '',
    state: state || '',
    stateCode: stateCode || '',
    owner: user._id
  });

  // Link firm to user
  if (!user.firms) user.firms = [];
  user.firms.push(firm._id);
  await User.findOneAndUpdate({ _id: user._id }, { firms: user.firms });

  res.status(201).json({
    success: true,
    token: generateToken(user._id),
    data: { 
      _id: user._id, 
      name: user.name, 
      username: user.username, 
      firms: [firm] 
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = username.trim();
  const escapedUsername = cleanUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const user = await User.findOne({ username: { $regex: new RegExp('^' + escapedUsername + '$', 'i') } }).populate('firms');
  
  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      success: true,
      token: generateToken(user._id),
      data: { _id: user._id, name: user.name, username: user.username, firms: user.firms }
    });
  } else {
    throw createError('Invalid username or password', 401);
  }
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('firms');
  res.json({ success: true, data: user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, username, password } = req.body;
  
  const user = await User.findById(req.user._id);
  if (!user) throw createError('User not found', 404);
  
  if (username && username.trim().toLowerCase() !== user.username) {
    const cleanUsername = username.trim();
    const escapedUsername = cleanUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existing = await User.findOne({ username: { $regex: new RegExp('^' + escapedUsername + '$', 'i') } });
    if (existing) throw createError('Username is already taken', 400);
    user.username = cleanUsername.toLowerCase();
  }
  
  if (name) user.name = name;
  
  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
  }
  
  await User.findOneAndUpdate({ _id: user._id }, {
    name: user.name,
    username: user.username,
    password: user.password
  });
  
  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      username: user.username
    }
  });
});

const checkUsername = asyncHandler(async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.json({ success: true, available: true });
  }
  const cleanUsername = username.trim();
  const escapedUsername = cleanUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const existing = await User.findOne({ username: { $regex: new RegExp('^' + escapedUsername + '$', 'i') } });
  res.json({ success: true, available: !existing });
});

module.exports = { register, login, getMe, updateProfile, checkUsername };
