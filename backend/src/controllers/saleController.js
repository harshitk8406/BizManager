const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Item = require('../models/Item');
const Customer = require('../models/Customer');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { calculateItemAmount } = require('../utils/gst');

const recalculateStock = async (itemId, firmId) => {
  const item = await Item.findOne({ _id: itemId, firm: firmId });
  if (!item) return;

  const purchases = await Purchase.find({ firm: firmId });
  let totalPurchased = 0;
  purchases.forEach(p => {
    (p.items || []).forEach(it => {
      if (it.item === itemId) {
        totalPurchased += it.quantity || 0;
      }
    });
  });

  const sales = await Sale.find({ firm: firmId });
  let totalSold = 0;
  sales.forEach(s => {
    (s.items || []).forEach(it => {
      if (it.item === itemId) {
        totalSold += it.quantity || 0;
      }
    });
  });

  const closingQuantity = item.openingQuantity + totalPurchased - totalSold;
  await Item.findOneAndUpdate({ _id: itemId, firm: firmId }, { closingQuantity });
};

// Update salesPrice in Item Master when a sale is saved
const updateItemSalesPrice = async (items, firmId) => {
  await Promise.all(
    items.map(i =>
      Item.findOneAndUpdate(
        { _id: i.item, firm: firmId },
        { salesPrice: Number(i.rate) }
      )
    )
  );
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
  if (req.body.roundOff) {
    totals.totalAmount = Math.round(totals.totalAmount);
  }

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
  await updateItemSalesPrice(items, req.firmId);

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
  if (req.body.roundOff) {
    totals.totalAmount = Math.round(totals.totalAmount);
  }

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
  await updateItemSalesPrice(items, req.firmId);

  const updated = await Sale.findOne({ _id: req.params.id, firm: req.firmId }).populate('customer').lean();
  res.json({ success: true, data: updated });
});

const deleteSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, firm: req.firmId });
  if (!sale) throw createError('Sale not found', 404);

  const itemIds = sale.items.map((i) => i.item.toString());
  await Sale.findOneAndDelete({ _id: req.params.id, firm: req.firmId });
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

  // Fetch ALL sales for this firm and find the highest serial number globally
  const allSales = await Sale.find({ firm: req.firmId });

  let maxSerial = 0;
  (allSales || []).forEach(s => {
    if (s.invoiceNumber) {
      const parts = s.invoiceNumber.split('-');
      const serial = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(serial) && serial > maxSerial) {
        maxSerial = serial;
      }
    }
  });

  const nextSerial = maxSerial + 1;
  const nextInvoiceNumber = `${prefix}${String(nextSerial).padStart(4, '0')}`;
  res.json({ success: true, data: nextInvoiceNumber });
});

module.exports = { getSales, getSaleById, createSale, updateSale, deleteSale, getNextInvoiceNumber };
