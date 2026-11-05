const Firm = require('../models/Firm');
const User = require('../models/User');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { verifyEmail: verifyEmailUtil } = require('../utils/emailVerifier');

const getMyFirms = asyncHandler(async (req, res) => {
  const firms = await Firm.find({ owner: req.user._id }).lean();
  res.json({ success: true, data: firms });
});

const createFirm = asyncHandler(async (req, res) => {
  if (!req.body.email || !req.body.email.trim()) {
    throw createError('Firm email address is mandatory', 400);
  }
  const { validateSyntax } = require('../utils/emailVerifier');
  const cleanEmail = req.body.email.trim().toLowerCase();
  const syntax = validateSyntax(cleanEmail);
  if (!syntax.valid) {
    throw createError(`Invalid email address: ${syntax.reason}`, 400);
  }
  req.body.email = cleanEmail;

  const firm = await Firm.create({ ...req.body, owner: req.user._id });
  
  // Add firm to user's firms array (use findOneAndUpdate — NeDB wrapper compatible)
  await User.findOneAndUpdate({ _id: req.user._id }, { $push: { firms: firm._id } });

  res.status(201).json({ success: true, data: firm });
});

const updateFirm = asyncHandler(async (req, res) => {
  if (req.body.email !== undefined) {
    if (!req.body.email || !req.body.email.trim()) {
      throw createError('Firm email address is mandatory', 400);
    }
    const { validateSyntax } = require('../utils/emailVerifier');
    const cleanEmail = req.body.email.trim().toLowerCase();
    const syntax = validateSyntax(cleanEmail);
    if (!syntax.valid) {
      throw createError(`Invalid email address: ${syntax.reason}`, 400);
    }
    req.body.email = cleanEmail;
  }

  const firm = await Firm.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!firm) throw createError('Firm not found or unauthorized', 404);
  res.json({ success: true, data: firm });
});

const verifyFirmEmail = asyncHandler(async (req, res) => {
  const { email, firmId } = req.body;
  if (!email || !email.trim()) {
    throw createError('Please provide an email address to verify', 400);
  }

  const result = await verifyEmailUtil(email.trim());

  let updatedFirm = null;
  if (firmId) {
    const updateData = {
      email: email.trim().toLowerCase(),
      isEmailVerified: result.valid,
      emailVerifiedAt: result.valid ? new Date() : null,
      emailVerificationStatus: result.status,
      emailVerificationReason: result.reason
    };
    updatedFirm = await Firm.findOneAndUpdate(
      { _id: firmId, owner: req.user._id },
      updateData,
      { new: true }
    );
  }

  res.json({ success: true, data: result, firm: updatedFirm });
});

module.exports = { getMyFirms, createFirm, updateFirm, verifyFirmEmail };
