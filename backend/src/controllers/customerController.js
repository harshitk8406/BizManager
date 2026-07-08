const Customer = require('../models/Customer');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const baseQuery = { firm: req.firmId };

  if (!search) {
    const customers = await Customer.find(baseQuery).limit(100).sort({ customerName: 1 }).lean();
    return res.json({ success: true, data: customers });
  }

  const prefixQuery = {
    ...baseQuery,
    customerName: { $regex: `^${search}`, $options: 'i' },
  };
  const containsQuery = {
    ...baseQuery,
    $or: [
      { customerName: { $regex: search, $options: 'i' } },
      { gstNumber:    { $regex: search, $options: 'i' } },
    ],
  };

  const [prefixMatches, allMatches] = await Promise.all([
    Customer.find(prefixQuery).sort({ customerName: 1 }).lean(),
    Customer.find(containsQuery).limit(30).sort({ customerName: 1 }).lean(),
  ]);

  const prefixIds = new Set(prefixMatches.map(c => c._id));
  const containsOnly = allMatches.filter(c => !prefixIds.has(c._id));
  const merged = [...prefixMatches, ...containsOnly].slice(0, 30);

  res.json({ success: true, data: merged });
});

const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, firm: req.firmId }).lean();
  if (!customer) throw createError('Customer not found', 404);
  res.json({ success: true, data: customer });
});

const getCustomerByGST = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ gstNumber: req.params.gst.toUpperCase(), firm: req.firmId }).lean();
  if (!customer) throw createError('Customer not found', 404);
  res.json({ success: true, data: customer });
});

const createCustomer = asyncHandler(async (req, res) => {
  const { gstNumber } = req.body;
  if (gstNumber && gstNumber.toUpperCase() !== 'CASH') {
    const existing = await Customer.findOne({ gstNumber: gstNumber.toUpperCase(), firm: req.firmId });
    if (existing) throw createError(`Customer with GST Number ${gstNumber} already exists`, 400);
  }
  const customerCode = await Customer.generateCustomerCode(req.firmId);
  const customer = await Customer.create({ ...req.body, firm: req.firmId, customerCode });
  res.status(201).json({ success: true, data: customer });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const { gstNumber } = req.body;
  if (gstNumber && gstNumber.toUpperCase() !== 'CASH') {
    const existing = await Customer.findOne({ gstNumber: gstNumber.toUpperCase(), _id: { $ne: req.params.id }, firm: req.firmId });
    if (existing) throw createError(`Customer with GST Number ${gstNumber} already exists`, 400);
  }
  const customer = await Customer.findOneAndUpdate({ _id: req.params.id, firm: req.firmId }, req.body, { new: true, runValidators: true });
  if (!customer) throw createError('Customer not found', 404);
  res.json({ success: true, data: customer });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndDelete({ _id: req.params.id, firm: req.firmId });
  if (!customer) throw createError('Customer not found', 404);
  res.json({ success: true, message: 'Customer deleted successfully' });
});

module.exports = { getCustomers, getCustomerById, getCustomerByGST, createCustomer, updateCustomer, deleteCustomer };
