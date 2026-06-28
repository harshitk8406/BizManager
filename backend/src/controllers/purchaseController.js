const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Item = require('../models/Item');
const Supplier = require('../models/Supplier');
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

  const latestPurchase = await Purchase.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.item': item._id, firm: firmObjId } },
    { $sort: { date: -1 } },
    { $limit: 1 },
    { $project: { rate: '$items.rate' } },
  ]);
  if (latestPurchase.length > 0) {
    item.purchasePrice = latestPurchase[0].rate;
  }

  await item.save();
};

const getPurchases = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, supplierGST, search } = req.query;
  let match = { firm: req.firmId };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to)   match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  // Filter by supplier GST number (primary key lookup)
  if (supplierGST) match.supplierGST = supplierGST;
  // Text search across invoice number or supplier name
  if (search) {
    match.$or = [
      { invoiceNumber:  { $regex: search, $options: 'i' } },
      { supplierName:   { $regex: search, $options: 'i' } },
    ];
  }

  const [purchases, total] = await Promise.all([
    Purchase.find(match)
      .populate('supplier', 'supplierName gstNumber')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean(),
    Purchase.countDocuments(match),
  ]);

  res.json({ success: true, data: purchases, total, page: Number(page), pages: Math.ceil(total / limit) });
});

const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, firm: req.firmId }).populate('supplier').lean();
  if (!purchase) throw createError('Purchase not found', 404);
  res.json({ success: true, data: purchase });
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

const createPurchase = asyncHandler(async (req, res) => {
  const { supplier: supplierId, items, isInterState = false, ...rest } = req.body;

  const existingInvoice = await Purchase.findOne({ supplier: supplierId, invoiceNumber: rest.invoiceNumber, firm: req.firmId });
  if (existingInvoice) throw createError(`Invoice number ${rest.invoiceNumber} already exists for this supplier`, 400);

  const supplier = await Supplier.findOne({ _id: supplierId, firm: req.firmId });
  if (!supplier) throw createError('Supplier not found', 404);

  const processedItems = processItems(items, isInterState);
  const totals = summarize(processedItems);

  const purchaseCode = await Purchase.generatePurchaseCode(req.firmId);

  const purchase = await Purchase.create({
    firm: req.firmId,
    purchaseCode,
    ...rest,
    supplier: supplierId,
    supplierName: supplier.supplierName,
    supplierGST: supplier.gstNumber,
    supplierAddress: supplier.supplierAddress,
    supplierPhone: supplier.supplierPhone,
    isInterState,
    items: processedItems,
    ...totals,
  });

  await Promise.all([...new Set(items.map((i) => i.item))].map(id => recalculateStock(id, req.firmId)));

  res.status(201).json({ success: true, data: purchase });
});

const updatePurchase = asyncHandler(async (req, res) => {
  const existing = await Purchase.findOne({ _id: req.params.id, firm: req.firmId });
  if (!existing) throw createError('Purchase not found', 404);

  const oldItemIds = existing.items.map((i) => i.item.toString());
  const { supplier: supplierId, items, isInterState = false, ...rest } = req.body;

  const existingInvoice = await Purchase.findOne({ supplier: supplierId, invoiceNumber: rest.invoiceNumber, _id: { $ne: req.params.id }, firm: req.firmId });
  if (existingInvoice) throw createError(`Invoice number ${rest.invoiceNumber} already exists for this supplier`, 400);

  const supplier = await Supplier.findOne({ _id: supplierId, firm: req.firmId });
  if (!supplier) throw createError('Supplier not found', 404);

  const processedItems = processItems(items, isInterState);
  const totals = summarize(processedItems);

  await Purchase.findOneAndUpdate({ _id: req.params.id, firm: req.firmId }, {
    ...rest,
    supplier: supplierId,
    supplierName: supplier.supplierName,
    supplierGST: supplier.gstNumber,
    supplierAddress: supplier.supplierAddress,
    supplierPhone: supplier.supplierPhone,
    isInterState,
    items: processedItems,
    ...totals,
  });

  const allItemIds = [...new Set([...oldItemIds, ...items.map((i) => i.item)])];
  await Promise.all(allItemIds.map(id => recalculateStock(id, req.firmId)));

  const updated = await Purchase.findOne({ _id: req.params.id, firm: req.firmId }).populate('supplier').lean();
  res.json({ success: true, data: updated });
});

const deletePurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, firm: req.firmId });
  if (!purchase) throw createError('Purchase not found', 404);

  const itemIds = purchase.items.map((i) => i.item.toString());
  await purchase.deleteOne();
  await Promise.all(itemIds.map(id => recalculateStock(id, req.firmId)));

  res.json({ success: true, message: 'Purchase deleted successfully' });
});

const getNextInvoiceNumber = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw createError('Date is required', 400);

  const targetDate = new Date(date);
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `PUR-${dateStr}-`;

  const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
  const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

  const lastPurchase = await Purchase.findOne({
    firm: req.firmId,
    date: { $gte: startOfDay, $lte: endOfDay },
    invoiceNumber: { $regex: `^${prefix}` }
  }).sort({ createdAt: -1, invoiceNumber: -1 }).lean();

  let nextSerial = 1;
  if (lastPurchase && lastPurchase.invoiceNumber) {
    const parts = lastPurchase.invoiceNumber.split('-');
    const lastSerialStr = parts[parts.length - 1];
    const lastSerial = parseInt(lastSerialStr, 10);
    if (!isNaN(lastSerial)) {
      nextSerial = lastSerial + 1;
    }
  }

  const nextInvoiceNumber = `${prefix}${String(nextSerial).padStart(4, '0')}`;
  res.json({ success: true, data: nextInvoiceNumber });
});

module.exports = { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase, getNextInvoiceNumber };
