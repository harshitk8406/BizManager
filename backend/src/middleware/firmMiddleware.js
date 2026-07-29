const { asyncHandler, createError } = require('./errorHandler');
const Firm = require('../models/Firm');

const requireFirm = asyncHandler(async (req, res, next) => {
  const firmId = req.headers['x-firm-id'];
  if (!firmId) throw createError('Firm ID is required in headers (X-Firm-Id)', 400);

  const firm = await Firm.findById(firmId);
  if (!firm) throw createError('Invalid Firm ID', 400);

  // Validate user owns the firm (optional but recommended)
  if (firm.owner.toString() !== req.user._id.toString()) {
    throw createError('Not authorized to access this firm', 403);
  }

  req.firmId = firmId;
  req.firm   = firm;   // attach full firm object for use in controllers
  next();
});

module.exports = { requireFirm };
