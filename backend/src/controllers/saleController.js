const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { calculateItemAmount } = require('../utils/gst');

const recalculateStock = async (itemId, firmId) => {
  const item = await Item.findOne({ _id: itemId, firm: firmId });
  if (!item) return;

  const firmObjId = new mongoose.Types.ObjectId(firmId);

  const purchaseAgg = await Purchase.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.item': item._id, firm: firmObjId } },
    { $group: { _id: null, total: { $sum: '$items.quantity' } } },
  ]);

  const saleAgg = await Sale.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.item': item._id, firm: firmObjId } },
    { $group: { _id: null, total: { $sum: '$items.quantity' } } },
  ]);

  const totalPurchased = purchaseAgg[0]?.total || 0;
  const totalSold = saleAgg[0]?.total || 0;
  item.closingQuantity = item.openingQuantity + totalPurchased - totalSold;
  await item.save();
};

const getSales = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, customerGST, search } = req.query;
  let match = { firm: req.firmId };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to)   match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  // Filter by customer GST number (primary key lookup)
  if (customerGST) match.customerGST = customerGST;
  // Text search across invoice number or customer name
  if (search) {
    match.$or = [
      { invoiceNumber: { $regex: search, $options: 'i' } },
      { customerName:  { $regex: search, $options: 'i' } },
    ];
  }

  const [sales, total] = await Promise.all([
    Sale.find(match)
      .populate('customer', 'customerName gstNumber')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    Sale.countDocuments(match),
  ]);

  res.json({ success: true, data: sales, total, page: Number(page), pages: Math.ceil(total / limit) });
});

const getSaleById = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, firm: req.firmId }).populate('customer').lean();
  if (!sale) throw createError('Sale not found', 404);
  res.json({ success: true, data: sale });
});

const processItems = (items, isInterState) => {
  return items.map((item) => {
    const gst = calculateItemAmount(item.quantity, item.rate, item.gstPercentage, isInterState);
    return {
      ...item,
      isInterState,
      taxableAmount: gst.taxableAmount,
      cgst: gst.cgst,
      sgst: gst.sgst,
      igst: gst.igst,
      totalTax: gst.totalTax,
      amount: gst.grandTotal,
    };
  });
};

const summarize = (processedItems) => ({
  subtotal: processedItems.reduce((s, i) => s + i.taxableAmount, 0),
  totalTax: processedItems.reduce((s, i) => s + i.totalTax, 0),
  totalCgst: processedItems.reduce((s, i) => s + i.cgst, 0),
  totalSgst: processedItems.reduce((s, i) => s + i.sgst, 0),
  totalIgst: processedItems.reduce((s, i) => s + i.igst, 0),
  totalAmount: processedItems.reduce((s, i) => s + i.amount, 0),
});

const createSale = asyncHandler(async (req, res) => {
  const { customer: customerId, items, isInterState = false, ...rest } = req.body;

  const existingInvoice = await Sale.findOne({ invoiceNumber: rest.invoiceNumber, firm: req.firmId });
  if (existingInvoice) throw createError(`Invoice number ${rest.invoiceNumber} already exists`, 400);

  const customer = await Customer.findOne({ _id: customerId, firm: req.firmId });
  if (!customer) throw createError('Customer not found', 404);

  const processedItems = processItems(items, isInterState);
  const totals = summarize(processedItems);

  const saleCode = await Sale.generateSaleCode(req.firmId);

  const sale = await Sale.create({
    firm: req.firmId,
    saleCode,
    ...rest,
    customer: customerId,
    customerName: customer.customerName,
    customerGST: customer.gstNumber,
    customerAddress: customer.customerAddress,
    customerPhone: customer.customerPhone,
    isInterState,
    items: processedItems,
    ...totals,
  });

  await Promise.all([...new Set(items.map((i) => i.item))].map(id => recalculateStock(id, req.firmId)));

  res.status(201).json({ success: true, data: sale });
});

const updateSale = asyncHandler(async (req, res) => {
  const existing = await Sale.findOne({ _id: req.params.id, firm: req.firmId });
  if (!existing) throw createError('Sale not found', 404);

  const oldItemIds = existing.items.map((i) => i.item.toString());
  const { customer: customerId, items, isInterState = false, ...rest } = req.body;

  const existingInvoice = await Sale.findOne({ invoiceNumber: rest.invoiceNumber, _id: { $ne: req.params.id }, firm: req.firmId });
  if (existingInvoice) throw createError(`Invoice number ${rest.invoiceNumber} already exists`, 400);

  const customer = await Customer.findOne({ _id: customerId, firm: req.firmId });
  if (!customer) throw createError('Customer not found', 404);

  const processedItems = processItems(items, isInterState);
  const totals = summarize(processedItems);

  await Sale.findOneAndUpdate({ _id: req.params.id, firm: req.firmId }, {
    ...rest,
    customer: customerId,
    customerName: customer.customerName,
    customerGST: customer.gstNumber,
    customerAddress: customer.customerAddress,
    customerPhone: customer.customerPhone,
    isInterState,
    items: processedItems,
    ...totals,
  });

  const allItemIds = [...new Set([...oldItemIds, ...items.map((i) => i.item)])];
  await Promise.all(allItemIds.map(id => recalculateStock(id, req.firmId)));

  const updated = await Sale.findOne({ _id: req.params.id, firm: req.firmId }).populate('customer').lean();
  res.json({ success: true, data: updated });
});

const deleteSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, firm: req.firmId });
  if (!sale) throw createError('Sale not found', 404);

  const itemIds = sale.items.map((i) => i.item.toString());
  await sale.deleteOne();
  await Promise.all(itemIds.map(id => recalculateStock(id, req.firmId)));

  res.json({ success: true, message: 'Sale deleted successfully' });
});

const getNextInvoiceNumber = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw createError('Date is required', 400);

  const targetDate = new Date(date);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `INV-${dateStr}-`;

  // Find the last invoice number for this firm on this date
  const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
  const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

  const lastSale = await Sale.findOne({
    firm: req.firmId,
    date: { $gte: startOfDay, $lte: endOfDay },
    invoiceNumber: { $regex: `^${prefix}` }
  }).sort({ createdAt: -1, invoiceNumber: -1 }).lean();

  let nextSerial = 1;
  if (lastSale && lastSale.invoiceNumber) {
    const parts = lastSale.invoiceNumber.split('-');
    const lastSerialStr = parts[parts.length - 1];
    const lastSerial = parseInt(lastSerialStr, 10);
    if (!isNaN(lastSerial)) {
      nextSerial = lastSerial + 1;
    }
  }

  const nextInvoiceNumber = `${prefix}${String(nextSerial).padStart(4, '0')}`;
  res.json({ success: true, data: nextInvoiceNumber });
});

module.exports = { getSales, getSaleById, createSale, updateSale, deleteSale, getNextInvoiceNumber };
