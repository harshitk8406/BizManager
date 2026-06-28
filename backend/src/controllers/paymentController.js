const mongoose = require('mongoose');
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
  const firmObjectId = new mongoose.Types.ObjectId(req.firmId);

  // Aggregate received payments
  const receivedSummary = await Payment.aggregate([
    { $match: { firm: firmObjectId, type: 'received' } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        cash: {
          $sum: {
            $cond: [{ $eq: ['$paymentMode', 'cash'] }, '$amount', 0]
          }
        },
        bank: {
          $sum: {
            $cond: [{ $eq: ['$paymentMode', 'bank'] }, '$amount', 0]
          }
        }
      }
    }
  ]);

  // Aggregate sent payments
  const sentSummary = await Payment.aggregate([
    { $match: { firm: firmObjectId, type: 'sent' } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        cash: {
          $sum: {
            $cond: [{ $eq: ['$paymentMode', 'cash'] }, '$amount', 0]
          }
        },
        bank: {
          $sum: {
            $cond: [{ $eq: ['$paymentMode', 'bank'] }, '$amount', 0]
          }
        }
      }
    }
  ]);

  const received = receivedSummary[0] || { total: 0, cash: 0, bank: 0 };
  const sent = sentSummary[0] || { total: 0, cash: 0, bank: 0 };
  const balance = received.total - sent.total;

  res.json({
    success: true,
    data: {
      received: {
        total: received.total,
        cash: received.cash,
        bank: received.bank
      },
      sent: {
        total: sent.total,
        cash: sent.cash,
        bank: sent.bank
      },
      balance
    }
  });
});

const getPartyBalances = asyncHandler(async (req, res) => {
  const firmObjectId = new mongoose.Types.ObjectId(req.firmId);

  // 1. Customer balances: Sales - Payments Received
  const customerSales = await Sale.aggregate([
    { $match: { firm: firmObjectId } },
    { $group: { _id: '$customer', totalSales: { $sum: '$totalAmount' } } }
  ]);

  const customerPayments = await Payment.aggregate([
    { $match: { firm: firmObjectId, type: 'received', partyType: 'customer' } },
    { $group: { _id: '$customer', totalPaid: { $sum: '$amount' } } }
  ]);

  const customersList = await Customer.find({ firm: req.firmId }).sort({ customerName: 1 }).lean();

  const salesMap = {};
  customerSales.forEach(s => { if (s._id) salesMap[s._id.toString()] = s.totalSales; });

  const paidMap = {};
  customerPayments.forEach(p => { if (p._id) paidMap[p._id.toString()] = p.totalPaid; });

  const customerBalances = customersList.map(c => {
    const idStr = c._id.toString();
    const totalSales = salesMap[idStr] || 0;
    const totalPaid = paidMap[idStr] || 0;
    return {
      _id: c._id,
      name: c.customerName,
      code: c.customerCode,
      gstNumber: c.gstNumber,
      phone: c.customerPhone,
      totalSales,
      totalPaid,
      balance: totalSales - totalPaid // Positive means customer owes us money
    };
  });

  // 2. Supplier balances: Purchases - Payments Sent
  const supplierPurchases = await Purchase.aggregate([
    { $match: { firm: firmObjectId } },
    { $group: { _id: '$supplier', totalPurchases: { $sum: '$totalAmount' } } }
  ]);

  const supplierPayments = await Payment.aggregate([
    { $match: { firm: firmObjectId, type: 'sent', partyType: 'supplier' } },
    { $group: { _id: '$supplier', totalPaid: { $sum: '$amount' } } }
  ]);

  const suppliersList = await Supplier.find({ firm: req.firmId }).sort({ supplierName: 1 }).lean();

  const purchasesMap = {};
  supplierPurchases.forEach(p => { if (p._id) purchasesMap[p._id.toString()] = p.totalPurchases; });

  const sentMap = {};
  supplierPayments.forEach(p => { if (p._id) sentMap[p._id.toString()] = p.totalPaid; });

  const supplierBalances = suppliersList.map(s => {
    const idStr = s._id.toString();
    const totalPurchases = purchasesMap[idStr] || 0;
    const totalPaid = sentMap[idStr] || 0;
    return {
      _id: s._id,
      name: s.supplierName,
      code: s.supplierCode,
      gstNumber: s.gstNumber,
      phone: s.supplierPhone,
      totalPurchases,
      totalPaid,
      balance: totalPurchases - totalPaid // Positive means we owe supplier money
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
