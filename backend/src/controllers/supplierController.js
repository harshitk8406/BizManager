const Supplier = require('../models/Supplier');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getSuppliers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const baseQuery = { firm: req.firmId };

  if (!search) {
    const suppliers = await Supplier.find(baseQuery).limit(100).sort({ supplierName: 1 }).lean();
    return res.json({ success: true, data: suppliers });
  }

  const prefixQuery = {
    ...baseQuery,
    supplierName: { $regex: `^${search}`, $options: 'i' },
  };
  const containsQuery = {
    ...baseQuery,
    $or: [
      { supplierName: { $regex: search, $options: 'i' } },
      { gstNumber:    { $regex: search, $options: 'i' } },
    ],
  };

  const [prefixMatches, allMatches] = await Promise.all([
    Supplier.find(prefixQuery).sort({ supplierName: 1 }).lean(),
    Supplier.find(containsQuery).limit(30).sort({ supplierName: 1 }).lean(),
  ]);

  const prefixIds = new Set(prefixMatches.map(s => s._id));
  const containsOnly = allMatches.filter(s => !prefixIds.has(s._id));
  const merged = [...prefixMatches, ...containsOnly].slice(0, 30);

  res.json({ success: true, data: merged });
});

const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, firm: req.firmId }).lean();
  if (!supplier) throw createError('Supplier not found', 404);
  res.json({ success: true, data: supplier });
});

const getSupplierByGST = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ gstNumber: req.params.gst.toUpperCase(), firm: req.firmId }).lean();
  if (!supplier) throw createError('Supplier not found', 404);
  res.json({ success: true, data: supplier });
});

const createSupplier = asyncHandler(async (req, res) => {
  const { gstNumber } = req.body;
  if (gstNumber && gstNumber.toUpperCase() !== 'CASH') {
    const existing = await Supplier.findOne({ gstNumber: gstNumber.toUpperCase(), firm: req.firmId });
    if (existing) throw createError(`Supplier with GST Number ${gstNumber} already exists`, 400);
  }
  const supplierCode = await Supplier.generateSupplierCode(req.firmId);
  const supplier = await Supplier.create({ ...req.body, firm: req.firmId, supplierCode });
  res.status(201).json({ success: true, data: supplier });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const { gstNumber } = req.body;
  if (gstNumber && gstNumber.toUpperCase() !== 'CASH') {
    const existing = await Supplier.findOne({ gstNumber: gstNumber.toUpperCase(), _id: { $ne: req.params.id }, firm: req.firmId });
    if (existing) throw createError(`Supplier with GST Number ${gstNumber} already exists`, 400);
  }
  const supplier = await Supplier.findOneAndUpdate({ _id: req.params.id, firm: req.firmId }, req.body, { new: true, runValidators: true });
  if (!supplier) throw createError('Supplier not found', 404);
  res.json({ success: true, data: supplier });
});

const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, firm: req.firmId });
  if (!supplier) throw createError('Supplier not found', 404);
  res.json({ success: true, message: 'Supplier deleted successfully' });
});

module.exports = { getSuppliers, getSupplierById, getSupplierByGST, createSupplier, updateSupplier, deleteSupplier };
