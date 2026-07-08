const Item = require('../models/Item');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const { asyncHandler } = require('../middleware/errorHandler');

/* ─── Stock Summary ────────────────────────────────────────── */
const getStockSummary = asyncHandler(async (req, res) => {
  const items = await Item.find({ firm: req.firmId }).sort({ itemCode: 1 }).lean();
  const report = items.map((item) => ({
    itemCode: item.itemCode,
    itemName: item.itemName,
    packingSize: item.packingSize,
    hsnCode: item.hsnCode,
    openingQuantity: item.openingQuantity,
    closingStock: item.closingQuantity,
    latestPurchasePrice: item.purchasePrice,
    salesPrice: item.salesPrice,
    gstPercentage: item.gstPercentage,
    amount: parseFloat((item.closingQuantity * item.purchasePrice).toFixed(2)),
  }));
  const totalValue = report.reduce((s, r) => s + r.amount, 0);
  res.json({ success: true, data: report, totalValue: parseFloat(totalValue.toFixed(2)) });
});

/* ─── Stock / Purchase Detail ──────────────────────────────── */
const getStockDetail = asyncHandler(async (req, res) => {
  const { from, to, itemCode } = req.query;
  let matchStage = { firm: req.firmId };
  if (from || to) {
    matchStage.date = {};
    if (from) matchStage.date.$gte = new Date(from);
    if (to)   matchStage.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  const purchases = await Purchase.find(matchStage);
  const result = [];
  purchases.forEach(p => {
    const pDate = p.date instanceof Date ? p.date : new Date(p.date);
    (p.items || []).forEach(item => {
      if (!itemCode || item.itemCode === itemCode) {
        result.push({
          date: pDate,
          invoiceNumber: p.invoiceNumber,
          supplierName: p.supplierName,
          supplierGST: p.supplierGST,
          itemCode: item.itemCode,
          itemName: item.itemName,
          hsnCode: item.hsnCode,
          packingSize: item.packingSize,
          quantity: item.quantity,
          rate: item.rate,
          gstPercentage: item.gstPercentage,
          taxableAmount: item.taxableAmount,
          cgst: item.cgst,
          sgst: item.sgst,
          igst: item.igst,
          totalTax: item.totalTax,
          amount: item.amount
        });
      }
    });
  });
  result.sort((a, b) => b.date - a.date);
  res.json({ success: true, data: result, count: result.length });
});

/* ─── Sales Detail ─────────────────────────────────────────── */
const getSalesDetail = asyncHandler(async (req, res) => {
  const { from, to, itemCode } = req.query;
  let matchStage = { firm: req.firmId };
  if (from || to) {
    matchStage.date = {};
    if (from) matchStage.date.$gte = new Date(from);
    if (to)   matchStage.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  const sales = await Sale.find(matchStage);
  const result = [];
  sales.forEach(s => {
    const sDate = s.date instanceof Date ? s.date : new Date(s.date);
    (s.items || []).forEach(item => {
      if (!itemCode || item.itemCode === itemCode) {
        result.push({
          date: sDate,
          invoiceNumber: s.invoiceNumber,
          customerName: s.customerName,
          customerGST: s.customerGST,
          isInterState: s.isInterState,
          itemCode: item.itemCode,
          itemName: item.itemName,
          hsnCode: item.hsnCode,
          packingSize: item.packingSize,
          quantity: item.quantity,
          rate: item.rate,
          gstPercentage: item.gstPercentage,
          taxableAmount: item.taxableAmount,
          cgst: item.cgst,
          sgst: item.sgst,
          igst: item.igst,
          totalTax: item.totalTax,
          amount: item.amount
        });
      }
    });
  });
  result.sort((a, b) => b.date - a.date);
  res.json({ success: true, data: result, count: result.length });
});

/* ─── GSTR-1 (Outward Supplies) ────────────────────────────── */
const getGSTR1 = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  let matchStage = { firm: req.firmId };
  if (from || to) {
    matchStage.date = {};
    if (from) matchStage.date.$gte = new Date(from);
    if (to)   matchStage.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const sales = await Sale.find(matchStage).sort({ date: 1 }).lean();

  // Separate B2B and B2C
  const b2bSales = sales.filter(s => s.customerGST && s.customerGST !== 'CASH');
  const b2cSales = sales.filter(s => !s.customerGST || s.customerGST === 'CASH');

  // B2B — grouped by customer GSTIN, with each invoice listed
  const b2bMap = {};
  b2bSales.forEach(sale => {
    const key = sale.customerGST;
    if (!b2bMap[key]) {
      b2bMap[key] = { gstNumber: sale.customerGST, customerName: sale.customerName, invoices: [], totalTaxable: 0, totalIgst: 0, totalCgst: 0, totalSgst: 0, totalTax: 0, grandTotal: 0 };
    }
    b2bMap[key].invoices.push({
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      isInterState: sale.isInterState,
      taxableAmount: sale.subtotal || 0,
      igst: sale.totalIgst || 0,
      cgst: sale.totalCgst || 0,
      sgst: sale.totalSgst || 0,
      totalTax: sale.totalTax || 0,
      totalAmount: sale.totalAmount || 0
    });
    b2bMap[key].totalTaxable += sale.subtotal || 0;
    b2bMap[key].totalIgst    += sale.totalIgst || 0;
    b2bMap[key].totalCgst    += sale.totalCgst || 0;
    b2bMap[key].totalSgst    += sale.totalSgst || 0;
    b2bMap[key].totalTax     += sale.totalTax  || 0;
    b2bMap[key].grandTotal   += sale.totalAmount || 0;
  });

  // B2C — total summary + list
  const b2c = {
    count: b2cSales.length,
    totalTaxable: b2cSales.reduce((s, x) => s + (x.subtotal || 0), 0),
    totalIgst:    b2cSales.reduce((s, x) => s + (x.totalIgst || 0), 0),
    totalCgst:    b2cSales.reduce((s, x) => s + (x.totalCgst || 0), 0),
    totalSgst:    b2cSales.reduce((s, x) => s + (x.totalSgst || 0), 0),
    totalTax:     b2cSales.reduce((s, x) => s + (x.totalTax  || 0), 0),
    grandTotal:   b2cSales.reduce((s, x) => s + (x.totalAmount || 0), 0),
    invoices: b2cSales.map(s => ({
      invoiceNumber: s.invoiceNumber,
      date: s.date,
      customerName: s.customerName,
      taxableAmount: s.subtotal || 0,
      cgst: s.totalCgst || 0,
      sgst: s.totalSgst || 0,
      igst: s.totalIgst || 0,
      totalTax: s.totalTax || 0,
      totalAmount: s.totalAmount || 0
    })),
  };

  // HSN-wise summary from all sales
  const hsnMap = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const key = `${item.hsnCode}_${item.gstPercentage}`;
      if (!hsnMap[key]) {
        hsnMap[key] = { hsnCode: item.hsnCode, description: item.itemName, gstPercentage: item.gstPercentage, totalQuantity: 0, totalTaxable: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0, totalAmount: 0 };
      }
      hsnMap[key].totalQuantity += item.quantity   || 0;
      hsnMap[key].totalTaxable  += item.taxableAmount || 0;
      hsnMap[key].totalCgst     += item.cgst        || 0;
      hsnMap[key].totalSgst     += item.sgst        || 0;
      hsnMap[key].totalIgst     += item.igst        || 0;
      hsnMap[key].totalTax      += item.totalTax    || 0;
      hsnMap[key].totalAmount   += item.amount      || 0;
    });
  });

  const totals = {
    totalSales:   sales.length,
    totalTaxable: sales.reduce((s, x) => s + (x.subtotal    || 0), 0),
    totalIgst:    sales.reduce((s, x) => s + (x.totalIgst   || 0), 0),
    totalCgst:    sales.reduce((s, x) => s + (x.totalCgst   || 0), 0),
    totalSgst:    sales.reduce((s, x) => s + (x.totalSgst   || 0), 0),
    totalTax:     sales.reduce((s, x) => s + (x.totalTax    || 0), 0),
    grandTotal:   sales.reduce((s, x) => s + (x.totalAmount || 0), 0),
  };

  res.json({ success: true, data: { period: { from, to }, b2b: Object.values(b2bMap), b2c, hsnSummary: Object.values(hsnMap), totals } });
});

/* ─── GSTR-3B (Summary Return) ─────────────────────────────── */
const getGSTR3B = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  let matchStage = { firm: req.firmId };
  if (from || to) {
    matchStage.date = {};
    if (from) matchStage.date.$gte = new Date(from);
    if (to)   matchStage.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const [sales, purchases] = await Promise.all([
    Sale.find(matchStage).lean(),
    Purchase.find(matchStage).lean(),
  ]);

  const sum = (arr, field) => arr.reduce((s, x) => s + (x[field] || 0), 0);

  // 3.1 — Outward taxable supplies
  const outward = {
    intraState: {
      taxable: sum(sales.filter(s => !s.isInterState), 'subtotal'),
      cgst:    sum(sales.filter(s => !s.isInterState), 'totalCgst'),
      sgst:    sum(sales.filter(s => !s.isInterState), 'totalSgst'),
      igst:    0,
    },
    interState: {
      taxable: sum(sales.filter(s =>  s.isInterState), 'subtotal'),
      cgst:    0,
      sgst:    0,
      igst:    sum(sales.filter(s =>  s.isInterState), 'totalIgst'),
    },
    total: {
      taxable: sum(sales, 'subtotal'),
      cgst:    sum(sales, 'totalCgst'),
      sgst:    sum(sales, 'totalSgst'),
      igst:    sum(sales, 'totalIgst'),
      tax:     sum(sales, 'totalTax'),
    },
  };

  // 4 — ITC available (from purchases)
  const itc = {
    intraState: {
      taxable: sum(purchases.filter(p => !p.isInterState), 'subtotal'),
      cgst:    sum(purchases.filter(p => !p.isInterState), 'totalCgst'),
      sgst:    sum(purchases.filter(p => !p.isInterState), 'totalSgst'),
      igst:    0,
    },
    interState: {
      taxable: sum(purchases.filter(p =>  p.isInterState), 'subtotal'),
      cgst:    0,
      sgst:    0,
      igst:    sum(purchases.filter(p =>  p.isInterState), 'totalIgst'),
    },
    total: {
      taxable: sum(purchases, 'subtotal'),
      cgst:    sum(purchases, 'totalCgst'),
      sgst:    sum(purchases, 'totalSgst'),
      igst:    sum(purchases, 'totalIgst'),
      tax:     sum(purchases, 'totalTax'),
    },
  };

  // Net tax payable after ITC
  const net = {
    cgst:  parseFloat(Math.max(0, outward.total.cgst - itc.total.cgst).toFixed(2)),
    sgst:  parseFloat(Math.max(0, outward.total.sgst - itc.total.sgst).toFixed(2)),
    igst:  parseFloat(Math.max(0, outward.total.igst - itc.total.igst).toFixed(2)),
  };
  net.total = parseFloat((net.cgst + net.sgst + net.igst).toFixed(2));

  // Round all values to 2dp
  const r2 = (v) => parseFloat((v || 0).toFixed(2));
  const roundSection = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'object' ? roundSection(v) : r2(v)]));

  res.json({ success: true, data: { period: { from, to }, outward: roundSection(outward), itc: roundSection(itc), net, counts: { sales: sales.length, purchases: purchases.length } } });
});

/* ─── Dashboard ─────────────────────────────────────────────── */
const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [items, recentPurchases, recentSales, monthlyPurchasesList, monthlySalesList] = await Promise.all([
    Item.find({ firm: req.firmId }).lean(),
    Purchase.find({ firm: req.firmId }).sort({ date: -1 }).limit(5).populate('supplier', 'supplierName').lean(),
    Sale.find({ firm: req.firmId }).sort({ date: -1 }).limit(5).populate('customer', 'customerName').lean(),
    Purchase.find({ date: { $gte: startOfMonth }, firm: req.firmId }).lean(),
    Sale.find({ date: { $gte: startOfMonth }, firm: req.firmId }).lean(),
  ]);
  const totalStockValue = items.reduce((s, i) => s + i.closingQuantity * i.purchasePrice, 0);
  const lowStockItems   = items.filter((i) => i.closingQuantity <= 0).length;
  const monthlyPurchases = monthlyPurchasesList.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const monthlySales = monthlySalesList.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  res.json({ success: true, data: { totalItems: items.length, totalStockValue: parseFloat(totalStockValue.toFixed(2)), lowStockItems, monthlyPurchases: parseFloat(monthlyPurchases.toFixed(2)), monthlySales: parseFloat(monthlySales.toFixed(2)), recentPurchases, recentSales } });
});

module.exports = { getStockSummary, getStockDetail, getSalesDetail, getGSTR1, getGSTR3B, getDashboardStats };
