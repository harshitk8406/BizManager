const User = require('../models/User');
const Firm = require('../models/Firm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { verifyEmail: verifyEmailUtil, validateSyntax, DISPOSABLE_DOMAINS } = require('../utils/emailVerifier');
const { sendPasswordResetOtp } = require('../utils/mailer');

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
  if (!email || !email.trim()) {
    throw createError('Email address is mandatory for registration', 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  const syntax = validateSyntax(cleanEmail);
  if (!syntax.valid) {
    throw createError(`Invalid email address: ${syntax.reason}`, 400);
  }
  if (DISPOSABLE_DOMAINS.has(syntax.domain)) {
    throw createError('Disposable or temporary email addresses are not permitted', 400);
  }

  const cleanUsername = username.trim();
  const escapedUsername = cleanUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const existing = await User.findOne({ username: { $regex: new RegExp('^' + escapedUsername + '$', 'i') } });
  if (existing) throw createError('Username is already taken', 400);

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({ 
    name, 
    username: cleanUsername.toLowerCase(), 
    email: cleanEmail,
    password: hashedPassword, 
    firms: [] 
  });

  // Create initial firm for the user
  const firm = await Firm.create({
    name: firmName,
    address,
    pincode: pincode || '',
    gstin: gstin || '',
    phone: phone || '',
    email: cleanEmail,
    isEmailVerified: !!req.body.isEmailVerified,
    emailVerifiedAt: req.body.isEmailVerified ? new Date() : null,
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
  const { name, username, email, password } = req.body;
  
  const user = await User.findById(req.user._id);
  if (!user) throw createError('User not found', 404);
  
  if (username && username.trim().toLowerCase() !== user.username) {
    const cleanUsername = username.trim();
    const escapedUsername = cleanUsername.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existing = await User.findOne({ username: { $regex: new RegExp('^' + escapedUsername + '$', 'i') } });
    if (existing) throw createError('Username is already taken', 400);
    user.username = cleanUsername.toLowerCase();
  }
  
  if (email !== undefined) {
    if (!email || !email.trim()) {
      throw createError('Email address is mandatory', 400);
    }
    const cleanEmail = email.trim().toLowerCase();
    const syntax = validateSyntax(cleanEmail);
    if (!syntax.valid) {
      throw createError(`Invalid email address: ${syntax.reason}`, 400);
    }
    user.email = cleanEmail;
  }

  if (name) user.name = name;
  
  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
  }
  
  await User.findOneAndUpdate({ _id: user._id }, {
    name: user.name,
    username: user.username,
    email: user.email,
    password: user.password
  });
  
  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email
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

const verifyEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    throw createError('Please provide an email address to verify', 400);
  }
  const result = await verifyEmailUtil(email.trim());
  res.json({ success: true, data: result });
});

// Helper: Mask email for privacy
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return user[0] + '*@' + domain;
  return user[0] + '*'.repeat(Math.min(user.length - 2, 4)) + user[user.length - 1] + '@' + domain;
}

// Helper: Locate user by username OR email (checking both User collection and Firm owner)
const findUserByIdentifier = async (identifier) => {
  if (!identifier || typeof identifier !== 'string') return null;
  const clean = identifier.trim();
  const escaped = clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('^' + escaped + '$', 'i');

  // 1. Search User by username OR direct email
  let user = await User.findOne({
    $or: [
      { username: { $regex: regex } },
      { email: { $regex: regex } }
    ]
  });

  // 2. If not found, search Firm collection by email and retrieve owner
  if (!user) {
    const firm = await Firm.findOne({ email: { $regex: regex } });
    if (firm && firm.owner) {
      user = await User.findById(firm.owner);
    }
  }

  return user;
};

// Helper: Resolve the registered email address of the firm owner
const getRegisteredEmailForUser = async (user) => {
  if (user.email && user.email.includes('@')) {
    return user.email;
  }
  const firms = await Firm.find({ owner: user._id });
  if (firms && firms.length > 0) {
    const firmWithEmail = firms.find(f => f.email && f.email.includes('@'));
    if (firmWithEmail) return firmWithEmail.email;
  }
  return null;
};

/**
 * Request Password Reset (Step 1): Send 6-digit OTP to firm owner's registered email
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  if (!identifier || !identifier.trim()) {
    throw createError('Please enter your username or registered email address', 400);
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    throw createError('No registered account found matching that username or email', 404);
  }

  const registeredEmail = await getRegisteredEmailForUser(user);
  if (!registeredEmail) {
    throw createError('No registered email address found on file for this account. Please contact administrator.', 400);
  }

  // Generate 6-digit OTP and store SHA-256 hash
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  await User.findOneAndUpdate(
    { _id: user._id },
    {
      resetPasswordOtp: hashedOtp,
      resetPasswordExpires: expiresAt,
      resetPasswordAttempts: 0
    }
  );

  await sendPasswordResetOtp(registeredEmail, otp, user.username);

  const masked = maskEmail(registeredEmail);

  res.json({
    success: true,
    message: `A 6-digit verification code has been sent to ${masked}`,
    maskedEmail: masked,
    username: user.username,
    devOtp: (!process.env.SMTP_HOST && !process.env.SMTP_USER) ? otp : undefined
  });
});

/**
 * Verify Password Reset OTP (Step 2): Validate OTP before letting owner set new password
 */
const verifyResetOtp = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.body;
  if (!identifier || !identifier.trim()) {
    throw createError('Identifier is required', 400);
  }
  if (!otp || !otp.trim()) {
    throw createError('Please enter the 6-digit OTP code', 400);
  }

  const user = await findUserByIdentifier(identifier);
  if (!user || !user.resetPasswordOtp) {
    throw createError('No active password reset request found. Please request a new OTP.', 400);
  }

  if (Date.now() > (user.resetPasswordExpires || 0)) {
    throw createError('The verification code has expired. Please request a new one.', 400);
  }

  if ((user.resetPasswordAttempts || 0) >= 5) {
    throw createError('Too many failed attempts. This OTP has been invalidated. Please request a new one.', 400);
  }

  const hashedInput = crypto.createHash('sha256').update(otp.trim()).digest('hex');
  if (hashedInput !== user.resetPasswordOtp) {
    await User.findOneAndUpdate(
      { _id: user._id },
      { resetPasswordAttempts: (user.resetPasswordAttempts || 0) + 1 }
    );
    throw createError('Invalid verification code. Please check and try again.', 400);
  }

  res.json({
    success: true,
    valid: true,
    message: 'Verification code confirmed successfully'
  });
});

/**
 * Reset Password (Step 3): Set new password and confirm matching password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { identifier, otp, newPassword, confirmPassword } = req.body;

  if (!identifier || !identifier.trim()) {
    throw createError('Identifier is required', 400);
  }
  if (!otp || !otp.trim()) {
    throw createError('Verification code is required', 400);
  }
  if (!newPassword || newPassword.length < 6) {
    throw createError('New password must be at least 6 characters long', 400);
  }
  if (newPassword !== confirmPassword) {
    throw createError('New password and confirm password do not match', 400);
  }

  const user = await findUserByIdentifier(identifier);
  if (!user || !user.resetPasswordOtp) {
    throw createError('No active password reset request found. Please request a new OTP.', 400);
  }

  if (Date.now() > (user.resetPasswordExpires || 0)) {
    throw createError('The verification code has expired. Please request a new one.', 400);
  }

  const hashedInput = crypto.createHash('sha256').update(otp.trim()).digest('hex');
  if (hashedInput !== user.resetPasswordOtp) {
    throw createError('Invalid verification code. Please check and try again.', 400);
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Clear OTP fields and update password
  await User.findOneAndUpdate(
    { _id: user._id },
    {
      password: hashedPassword,
      resetPasswordOtp: null,
      resetPasswordExpires: null,
      resetPasswordAttempts: 0
    }
  );

  res.json({
    success: true,
    message: 'Password has been reset successfully. You can now log in with your new password.'
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  checkUsername,
  verifyEmail,
  forgotPassword,
  verifyResetOtp,
  resetPassword
};
