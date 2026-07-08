const Challan = require('../models/Challan');
const Sale = require('../models/Sale');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { calculateItemAmount } = require('../utils/gst');

/* ── Stock recalculation (same logic as saleController) ─────── */
const recalculateStock = async (itemId, firmId) => {
  const item = await Item.findOne({ _id: itemId, firm: firmId });
  if (!item) return;

  const Purchase = require('../models/Purchase');
  const purchases = await Purchase.find({ firm: firmId });
  let totalPurchased = 0;
  purchases.forEach(p => {
    (p.items || []).forEach(it => {
      if (it.item === itemId) totalPurchased += it.quantity || 0;
    });
  });

  const sales = await Sale.find({ firm: firmId });
  let totalSold = 0;
  sales.forEach(s => {
    (s.items || []).forEach(it => {
      if (it.item === itemId) totalSold += it.quantity || 0;
    });
  });

  const closingQuantity = item.openingQuantity + totalPurchased - totalSold;
  await Item.findOneAndUpdate({ _id: itemId, firm: firmId }, { closingQuantity });
};

/* ── List challans ───────────────────────────────────────────── */
const getChallans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, status, search } = req.query;
  let match = { firm: req.firmId };

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to)   match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  if (status) match.status = status;
  if (search) {
    match.$or = [
      { challanNumber: { $regex: search, $options: 'i' } },
      { customerName:  { $regex: search, $options: 'i' } },
    ];
  }

  const [challans, total] = await Promise.all([
    Challan.find(match)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    Challan.countDocuments(match),
  ]);

  res.json({ success: true, data: challans, total, page: Number(page), pages: Math.ceil(total / limit) });
});

/* ── Single challan ──────────────────────────────────────────── */
const getChallanById = asyncHandler(async (req, res) => {
  const challan = await Challan.findOne({ _id: req.params.id, firm: req.firmId }).lean();
  if (!challan) throw createError('Challan not found', 404);
  res.json({ success: true, data: challan });
});

/* ── Next challan number ─────────────────────────────────────── */
const getNextChallanNumber = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw createError('Date is required', 400);

  const targetDate = new Date(date);
  const year  = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day   = String(targetDate.getDate()).padStart(2, '0');
  const prefix = `CHN-${year}${month}${day}-`;

  const allChallans = await Challan.find({ firm: req.firmId });
  let maxSerial = 0;
  (allChallans || []).forEach(c => {
    if (c.challanNumber) {
      const parts = c.challanNumber.split('-');
      const serial = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(serial) && serial > maxSerial) maxSerial = serial;
    }
  });

  const nextNumber = `${prefix}${String(maxSerial + 1).padStart(4, '0')}`;
  res.json({ success: true, data: nextNumber });
});

/* ── Create challan ──────────────────────────────────────────── */
const createChallan = asyncHandler(async (req, res) => {
  const { customer: customerId, items, ...rest } = req.body;

  // Check for duplicate challan number
  const existing = await Challan.findOne({ challanNumber: rest.challanNumber, firm: req.firmId });
  if (existing) throw createError(`Challan number ${rest.challanNumber} already exists`, 400);

  const customer = await Customer.findOne({ _id: customerId, firm: req.firmId });
  if (!customer) throw createError('Customer not found', 404);

  // Simple item amounts — no GST for delivery challan
  const processedItems = (items || []).map(it => ({
    ...it,
    amount: Number(it.quantity || 0) * Number(it.rate || 0),
  }));
  const totalAmount = processedItems.reduce((s, i) => s + (i.amount || 0), 0);

  const challanCode = await Challan.generateChallanCode(req.firmId);

  const challan = await Challan.create({
    firm: req.firmId,
    challanCode,
    ...rest,
    customer: customerId,
    customerName: customer.customerName,
    customerGST: customer.gstNumber || '',
    customerAddress: customer.customerAddress || '',
    customerPhone: customer.customerPhone || '',
    status: rest.status || 'draft',
    items: processedItems,
    totalAmount,
    convertedToSaleId: null,
    convertedInvoiceNumber: null,
  });

  res.status(201).json({ success: true, data: challan });
});

/* ── Update challan ──────────────────────────────────────────── */
const updateChallan = asyncHandler(async (req, res) => {
  const existing = await Challan.findOne({ _id: req.params.id, firm: req.firmId });
  if (!existing) throw createError('Challan not found', 404);
  if (existing.status === 'converted') throw createError('Cannot edit a converted challan', 400);

  const { customer: customerId, items, ...rest } = req.body;

  // Duplicate number check (exclude self)
  if (rest.challanNumber && rest.challanNumber !== existing.challanNumber) {
    const dup = await Challan.findOne({ challanNumber: rest.challanNumber, firm: req.firmId });
    if (dup && dup._id !== req.params.id) throw createError(`Challan number ${rest.challanNumber} already exists`, 400);
  }

  const customer = await Customer.findOne({ _id: customerId, firm: req.firmId });
  if (!customer) throw createError('Customer not found', 404);

  const processedItems = (items || []).map(it => ({
    ...it,
    amount: Number(it.quantity || 0) * Number(it.rate || 0),
  }));
  const totalAmount = processedItems.reduce((s, i) => s + (i.amount || 0), 0);

  const updated = await Challan.findOneAndUpdate(
    { _id: req.params.id, firm: req.firmId },
    {
      ...rest,
      customer: customerId,
      customerName: customer.customerName,
      customerGST: customer.gstNumber || '',
      customerAddress: customer.customerAddress || '',
      customerPhone: customer.customerPhone || '',
      items: processedItems,
      totalAmount,
    },
    { new: true }
  );

  res.json({ success: true, data: updated });
});

/* ── Delete challan ──────────────────────────────────────────── */
const deleteChallan = asyncHandler(async (req, res) => {
  const challan = await Challan.findOne({ _id: req.params.id, firm: req.firmId });
  if (!challan) throw createError('Challan not found', 404);
  if (challan.status === 'converted') throw createError('Cannot delete a converted challan', 400);

  await Challan.findOneAndDelete({ _id: req.params.id, firm: req.firmId });
  res.json({ success: true, message: 'Challan deleted successfully' });
});

/* ── Convert challan → Sale Invoice ─────────────────────────── */
const convertToInvoice = asyncHandler(async (req, res) => {
  const challan = await Challan.findOne({ _id: req.params.id, firm: req.firmId });
  if (!challan) throw createError('Challan not found', 404);
  if (challan.status === 'converted') throw createError('Challan already converted to an invoice', 400);
  if (challan.status === 'cancelled') throw createError('Cannot convert a cancelled challan', 400);

  const { invoiceNumber, isInterState = false, roundOff = false, date } = req.body;

  // Check invoice number uniqueness
  const existingInv = await Sale.findOne({ invoiceNumber, firm: req.firmId });
  if (existingInv) throw createError(`Invoice number ${invoiceNumber} already exists`, 400);

  const customer = await Customer.findOne({ _id: challan.customer, firm: req.firmId });
  if (!customer) throw createError('Customer not found', 404);

  // For each challan item, fetch gstPercentage from Item Master
  const enrichedItems = await Promise.all(
    (challan.items || []).map(async (ci) => {
      const masterItem = ci.item ? await Item.findOne({ _id: ci.item, firm: req.firmId }) : null;
      return {
        ...ci,
        gstPercentage: masterItem ? (masterItem.gstPercentage || 0) : (ci.gstPercentage || 0),
      };
    })
  );

  // Calculate GST for each item
  const processedItems = enrichedItems.map(it => {
    const gst = calculateItemAmount(it.quantity, it.rate, it.gstPercentage, isInterState);
    return {
      ...it,
      isInterState,
      taxableAmount: gst.taxableAmount,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      totalTax: gst.totalTax,
      amount: gst.grandTotal,
    };
  });

  const subtotal    = processedItems.reduce((s, i) => s + i.taxableAmount, 0);
  const totalTax    = processedItems.reduce((s, i) => s + i.totalTax, 0);
  const totalCgst   = processedItems.reduce((s, i) => s + i.cgst, 0);
  const totalSgst   = processedItems.reduce((s, i) => s + i.sgst, 0);
  const totalIgst   = processedItems.reduce((s, i) => s + i.igst, 0);
  let   totalAmount = processedItems.reduce((s, i) => s + i.amount, 0);
  if (roundOff) totalAmount = Math.round(totalAmount);

  const saleCode = await Sale.generateSaleCode(req.firmId);
  const sale = await Sale.create({
    firm: req.firmId,
    saleCode,
    invoiceNumber,
    date: date ? new Date(date) : new Date(),
    customer: challan.customer,
    customerName: customer.customerName,
    customerGST: customer.gstNumber || '',
    customerAddress: customer.customerAddress || '',
    customerPhone: customer.customerPhone || '',
    isInterState,
    items: processedItems,
    subtotal,
    totalTax,
    totalCgst,
    totalSgst,
    totalIgst,
    totalAmount,
    roundOff,
    fromChallanId: challan._id,
    fromChallanNumber: challan.challanNumber,
  });

  // Mark challan as converted
  await Challan.findOneAndUpdate(
    { _id: req.params.id, firm: req.firmId },
    { status: 'converted', convertedToSaleId: sale._id, convertedInvoiceNumber: invoiceNumber }
  );

  // Recalculate stock for all items (stock reduces at invoice stage)
  const itemIds = [...new Set(processedItems.map(i => i.item).filter(Boolean))];
  await Promise.all(itemIds.map(id => recalculateStock(id, req.firmId)));

  // Update salesPrice in Item Master
  await Promise.all(
    processedItems.map(i =>
      i.item ? Item.findOneAndUpdate({ _id: i.item, firm: req.firmId }, { salesPrice: Number(i.rate) }) : Promise.resolve()
    )
  );

  res.status(201).json({ success: true, data: { sale, challan: { ...challan, status: 'converted', convertedInvoiceNumber: invoiceNumber } } });
});

module.exports = {
  getChallans,
  getChallanById,
  getNextChallanNumber,
  createChallan,
  updateChallan,
  deleteChallan,
  convertToInvoice,
};
