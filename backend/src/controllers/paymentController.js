const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const { asyncHandler, createError } = require('../middleware/errorHandler');

const getPayments = asyncHandler(async (req, res) => {
  const { search, type, paymentMode, startDate, endDate } = req.query;
  let query = { firm: req.firmId };

  if (type) {
    query.type = type;
  }
  if (paymentMode) {
    query.paymentMode = paymentMode;
  }

  // Handle date filters
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      // Set to end of day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Handle search (remarks, referenceNumber, bankName, or amount query)
  if (search) {
    const searchRegex = { $regex: search, $options: 'i' };
    const amountVal = parseFloat(search);
    
    query.$or = [
      { remarks: searchRegex },
      { referenceNumber: searchRegex },
      { bankName: searchRegex }
    ];

    if (!isNaN(amountVal)) {
      query.$or.push({ amount: amountVal });
    }
  }

  const payments = await Payment.find(query)
    .populate('customer', 'customerName customerCode gstNumber')
    .populate('supplier', 'supplierName supplierCode gstNumber')
    .sort({ date: -1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: payments });
});

const getPaymentSummary = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ firm: req.firmId });

  const received = { total: 0, cash: 0, bank: 0 };
  const sent = { total: 0, cash: 0, bank: 0 };

  payments.forEach(p => {
    if (p.type === 'received') {
      received.total += p.amount || 0;
      if (p.paymentMode === 'cash') received.cash += p.amount || 0;
      else if (p.paymentMode === 'bank') received.bank += p.amount || 0;
    } else if (p.type === 'sent') {
      sent.total += p.amount || 0;
      if (p.paymentMode === 'cash') sent.cash += p.amount || 0;
      else if (p.paymentMode === 'bank') sent.bank += p.amount || 0;
    }
  });

  const balance = received.total - sent.total;

  res.json({
    success: true,
    data: {
      received,
      sent,
      balance
    }
  });
});

const getPartyBalances = asyncHandler(async (req, res) => {
  const [sales, purchases, payments, customersList, suppliersList] = await Promise.all([
    Sale.find({ firm: req.firmId }),
    Purchase.find({ firm: req.firmId }),
    Payment.find({ firm: req.firmId }),
    Customer.find({ firm: req.firmId }).sort({ customerName: 1 }).lean(),
    Supplier.find({ firm: req.firmId }).sort({ supplierName: 1 }).lean()
  ]);

  // 1. Map sales by customer
  const salesMap = {};
  sales.forEach(s => {
    if (s.customer) {
      salesMap[s.customer] = (salesMap[s.customer] || 0) + (s.totalAmount || 0);
    }
  });

  // 2. Map customer payments
  const customerPaidMap = {};
  payments.forEach(p => {
    if (p.type === 'received' && p.partyType === 'customer' && p.customer) {
      customerPaidMap[p.customer] = (customerPaidMap[p.customer] || 0) + (p.amount || 0);
    }
  });

  const customerBalances = customersList.map(c => {
    const totalSales = salesMap[c._id] || 0;
    const totalPaid = customerPaidMap[c._id] || 0;
    return {
      _id: c._id,
      name: c.customerName,
      code: c.customerCode,
      gstNumber: c.gstNumber,
      phone: c.customerPhone,
      totalSales,
      totalPaid,
      balance: totalSales - totalPaid
    };
  });

  // 3. Map purchases by supplier
  const purchasesMap = {};
  purchases.forEach(p => {
    if (p.supplier) {
      purchasesMap[p.supplier] = (purchasesMap[p.supplier] || 0) + (p.totalAmount || 0);
    }
  });

  // 4. Map supplier payments
  const supplierPaidMap = {};
  payments.forEach(p => {
    if (p.type === 'sent' && p.partyType === 'supplier' && p.supplier) {
      supplierPaidMap[p.supplier] = (supplierPaidMap[p.supplier] || 0) + (p.amount || 0);
    }
  });

  const supplierBalances = suppliersList.map(s => {
    const totalPurchases = purchasesMap[s._id] || 0;
    const totalPaid = supplierPaidMap[s._id] || 0;
    return {
      _id: s._id,
      name: s.supplierName,
      code: s.supplierCode,
      gstNumber: s.gstNumber,
      phone: s.supplierPhone,
      totalPurchases,
      totalPaid,
      balance: totalPurchases - totalPaid
    };
  });

  res.json({
    success: true,
    data: {
      customers: customerBalances,
      suppliers: supplierBalances
    }
  });
});

const createPayment = asyncHandler(async (req, res) => {
  const { type, partyType, customer, supplier, amount, paymentMode, bankName } = req.body;

  if (!type || !partyType || !amount || !paymentMode) {
    throw createError('Required fields are missing', 400);
  }

  if (partyType === 'customer' && !customer) {
    throw createError('Customer reference is required', 400);
  }

  if (partyType === 'supplier' && !supplier) {
    throw createError('Supplier reference is required', 400);
  }

  if (paymentMode === 'bank' && !bankName) {
    throw createError('Bank Name is required for Bank payments', 400);
  }

  if (paymentMode === 'bank' && (!req.body.referenceNumber || !req.body.referenceNumber.trim())) {
    throw createError('Reference number (UPI/Check/UTR) is required for Bank payments', 400);
  }

  const payment = await Payment.create({
    ...req.body,
    firm: req.firmId
  });

  res.status(201).json({ success: true, data: payment });
});

const updatePayment = asyncHandler(async (req, res) => {
  const { type, partyType, customer, supplier, amount, paymentMode, bankName } = req.body;

  if (partyType === 'customer' && !customer) {
    throw createError('Customer reference is required', 400);
  }

  if (partyType === 'supplier' && !supplier) {
    throw createError('Supplier reference is required', 400);
  }

  if (paymentMode === 'bank' && !bankName) {
    throw createError('Bank Name is required for Bank payments', 400);
  }

  if (paymentMode === 'bank' && (!req.body.referenceNumber || !req.body.referenceNumber.trim())) {
    throw createError('Reference number (UPI/Check/UTR) is required for Bank payments', 400);
  }

  const payment = await Payment.findOneAndUpdate(
    { _id: req.params.id, firm: req.firmId },
    req.body,
    { new: true, runValidators: true }
  );

  if (!payment) {
    throw createError('Payment not found', 404);
  }

  res.json({ success: true, data: payment });
});

const deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOneAndDelete({ _id: req.params.id, firm: req.firmId });

  if (!payment) {
    throw createError('Payment not found', 404);
  }

  res.json({ success: true, message: 'Payment deleted successfully' });
});

module.exports = {
  getPayments,
  getPaymentSummary,
  getPartyBalances,
  createPayment,
  updatePayment,
  deletePayment
};
