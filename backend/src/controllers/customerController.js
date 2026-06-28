const Customer = require('../models/Customer');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  let query = { firm: req.firmId };
  if (search) {
    query = {
      $or: [
        { customerName: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } },
      ],
      firm: req.firmId
    };
  }
  const customers = await Customer.find(query).limit(100).sort({ customerName: 1 }).lean();
  res.json({ success: true, data: customers });
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
