const Firm = require('../models/Firm');
const User = require('../models/User');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getMyFirms = asyncHandler(async (req, res) => {
  const firms = await Firm.find({ owner: req.user._id }).lean();
  res.json({ success: true, data: firms });
});

const createFirm = asyncHandler(async (req, res) => {
  const firm = await Firm.create({ ...req.body, owner: req.user._id });
  
  // Add firm to user's firms array
  await User.findByIdAndUpdate(req.user._id, { $push: { firms: firm._id } });

  res.status(201).json({ success: true, data: firm });
});

const updateFirm = asyncHandler(async (req, res) => {
  const firm = await Firm.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!firm) throw createError('Firm not found or unauthorized', 404);
  res.json({ success: true, data: firm });
});

module.exports = { getMyFirms, createFirm, updateFirm };
