const { groqChat } = require('../utils/groq');
const { asyncHandler } = require('../middleware/errorHandler');
const aiCache = require('../utils/aiCache');
const Item = require('../models/Item');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');

const TTL_HSN        = 7 * 24 * 60 * 60 * 1000;  // 7 days  — HSN codes are static
const TTL_ANOMALY    = 2 * 60 * 60 * 1000;         // 2 hours — same item+price = same verdict
const TTL_DASHBOARD  = 6 * 60 * 60 * 1000;         // 6 hours — refresh insights twice a day

/* ─────────────────────────────────────────────────────────────
   1. AI Business Chatbot
   POST /api/ai/chat
   Body: { message: string, history: [{role, content}] }
   ───────────────────────────────────────────────────────────── */
const aiChat = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

  // Gather live business context from local DB
  const [items, recentPurchases, recentSales] = await Promise.all([
    Item.find({ firm: req.firmId }).lean(),
    Purchase.find({ firm: req.firmId }).sort({ date: -1 }).limit(10).lean(),
    Sale.find({ firm: req.firmId }).sort({ date: -1 }).limit(10).lean(),
  ]);

  const lowStock = items.filter(i => i.closingQuantity <= 0);
  const totalStockValue = items.reduce((s, i) => s + i.closingQuantity * i.purchasePrice, 0);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthPurchases = await Purchase.find({ firm: req.firmId, date: { $gte: startOfMonth } }).lean();
  const monthSales = await Sale.find({ firm: req.firmId, date: { $gte: startOfMonth } }).lean();

  const monthlyPurchaseTotal = monthPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const monthlySalesTotal = monthSales.reduce((s, s2) => s + (s2.totalAmount || 0), 0);

  const contextSummary = `
Business Data Summary (as of ${now.toLocaleDateString('en-IN')}):
- Total Items: ${items.length}
- Total Stock Value: ₹${totalStockValue.toFixed(2)}
- Out of Stock Items: ${lowStock.length} (${lowStock.map(i => i.itemName).slice(0, 5).join(', ')}${lowStock.length > 5 ? '...' : ''})
- This Month Purchases: ₹${monthlyPurchaseTotal.toFixed(2)} (${monthPurchases.length} transactions)
- This Month Sales: ₹${monthlySalesTotal.toFixed(2)} (${monthSales.length} transactions)
- Recent Purchases (last 10): ${recentPurchases.map(p => `${p.supplierName} — ₹${p.totalAmount}`).join('; ')}
- Recent Sales (last 10): ${recentSales.map(s => `${s.customerName} — ₹${s.totalAmount}`).join('; ')}
- Top Items by Stock Value: ${[...items].sort((a, b) => (b.closingQuantity * b.purchasePrice) - (a.closingQuantity * a.purchasePrice)).slice(0, 5).map(i => `${i.itemName} (${i.closingQuantity} units @ ₹${i.purchasePrice})`).join('; ')}
`.trim();

  const systemPrompt = `You are BizManager AI, a helpful business assistant for a GST-compliant Indian business management application. 
You have access to the business owner's live data shown below. Answer questions concisely and accurately based on this data.
Use Indian Rupee (₹) for all currency values. Keep responses under 200 words unless detail is needed. Be friendly and professional.

${contextSummary}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6), // Keep last 6 messages for context
    { role: 'user', content: message },
  ];

  const reply = await groqChat({ messages, model: 'llama-3.1-8b-instant', maxTokens: 512, userId: req.user?._id });
  res.json({ success: true, data: { reply } });
});

/* ─────────────────────────────────────────────────────────────
   2. HSN Code & GST % Suggester
   POST /api/ai/hsn-suggest
   Body: { itemName: string, packingSize?: string }
   ───────────────────────────────────────────────────────────── */
const aiHsnSuggest = asyncHandler(async (req, res) => {
  const { itemName, packingSize } = req.body;
  if (!itemName?.trim()) return res.status(400).json({ success: false, message: 'Item name is required' });

  // Cache key: item name + packing size (HSN codes are static — safe to cache 7 days)
  const cacheKey = aiCache.key('hsn', itemName, packingSize || '');
  const cached = aiCache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const messages = [
    {
      role: 'system',
      content: `You are an expert in Indian GST and HSN (Harmonized System of Nomenclature) codes. 
Given an item name and optional packing size, respond ONLY with a valid JSON object in this exact format:
{"hsnCode": "XXXXXXXX", "gstPercentage": 5, "description": "brief reason"}
- hsnCode: 4-8 digit HSN code (string)
- gstPercentage: must be one of 0, 5, 12, 18, or 28 (number)
- description: 1 sentence explaining why this HSN/GST applies
Do NOT include any text outside the JSON object.`
    },
    {
      role: 'user',
      content: `Item Name: ${itemName}${packingSize ? `\nPacking Size: ${packingSize}` : ''}`
    }
  ];

  const raw = await groqChat({ messages, model: 'llama-3.1-8b-instant', maxTokens: 200, userId: req.user?._id });

  let parsed;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
    const validSlabs = [0, 5, 12, 18, 28];
    if (!validSlabs.includes(parsed.gstPercentage)) parsed.gstPercentage = 5;
  } catch {
    return res.status(422).json({ success: false, message: 'AI could not determine HSN code for this item. Please enter manually.' });
  }

  aiCache.set(cacheKey, parsed, TTL_HSN); // Cache for 7 days
  res.json({ success: true, data: parsed });
});

/* ─────────────────────────────────────────────────────────────
   3. Anomaly Detection for Purchase / Sale
   POST /api/ai/anomaly-check
   Body: { type: 'purchase'|'sale', items: [], supplierName?, customerName?, totalAmount }
   ───────────────────────────────────────────────────────────── */
const aiAnomalyCheck = asyncHandler(async (req, res) => {
  const { type, items, supplierName, customerName, totalAmount } = req.body;

  // Cache key: firm + type + sorted item fingerprint (name+rate rounded to nearest 10)
  // Rounding rate prevents cache miss on ₹99.90 vs ₹100.10 — same anomaly verdict
  const itemFingerprint = (items || [])
    .map(i => `${(i.itemName || i.name || '').toLowerCase()}:${Math.round((i.rate || 0) / 10) * 10}`)
    .sort()
    .join(',');
  const cacheKey = aiCache.key('anomaly', req.firmId, type, itemFingerprint);
  const cached = aiCache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  // Get last 15 purchases/sales to compare
  let history = [];
  if (type === 'purchase') {
    history = await Purchase.find({ firm: req.firmId }).sort({ date: -1 }).limit(15).lean();
  } else {
    history = await Sale.find({ firm: req.firmId }).sort({ date: -1 }).limit(15).lean();
  }

  const itemSummary = (items || []).map(item => ({
    name: item.itemName || item.name,
    qty: item.quantity,
    rate: item.rate,
  }));

  const historyText = history.slice(0, 8).map(t => {
    const itemsText = (t.items || []).map(i => `${i.itemName}: qty=${i.quantity}, rate=₹${i.rate}`).join('; ');
    return `${type === 'purchase' ? t.supplierName : t.customerName} | ₹${t.totalAmount} | ${itemsText}`;
  }).join('\n');

  const messages = [
    {
      role: 'system',
      content: `You are a business transaction auditor for an Indian GST business. 
Analyze a new ${type} entry for potential anomalies like unusual prices, very large quantities, or suspicious patterns compared to historical data.
Respond ONLY with a JSON object: {"anomaly": true/false, "warning": "brief warning message or null"}
- anomaly: true only if there is a genuine concern worth flagging
- warning: null if no anomaly, otherwise a 1-sentence explanation in plain English
Do NOT flag entries as anomalies just because they are new or have zero history. Only flag clear outliers.`
    },
    {
      role: 'user',
      content: `New ${type} entry:
Party: ${supplierName || customerName || 'Unknown'}
Total Amount: ₹${totalAmount}
Items: ${itemSummary.map(i => `${i.name} — qty: ${i.qty}, rate: ₹${i.rate}`).join('; ')}

Recent ${type} history:
${historyText || 'No history available yet.'}`
    }
  ];

  const raw = await groqChat({ messages, model: 'llama-3.1-8b-instant', maxTokens: 150, userId: req.user?._id });

  let result = { anomaly: false, warning: null };
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    result = JSON.parse(match ? match[0] : raw);
  } catch {
    // If parsing fails, don't block the user — just return no anomaly
  }

  aiCache.set(cacheKey, result, TTL_ANOMALY); // Cache 2 hours
  res.json({ success: true, data: result });
});

/* ─────────────────────────────────────────────────────────────
   4. AI Dashboard / Report Summary
   POST /api/ai/report-summary
   Body: { stats: {} }
   ───────────────────────────────────────────────────────────── */
const aiReportSummary = asyncHandler(async (req, res) => {
  const { stats } = req.body;

  // Cache dashboard insights per firm for 6 hours
  // Key includes month so it auto-invalidates each new month
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const cacheKey = aiCache.key('dashboard', req.firmId, monthKey);
  const cached = aiCache.get(cacheKey);
  if (cached) return res.json({ success: true, data: { summary: cached }, cached: true });

  const items = await Item.find({ firm: req.firmId }).lean();
  const lowStockItems = items.filter(i => i.closingQuantity <= 5);
  const topItems = [...items]
    .sort((a, b) => (b.closingQuantity * b.purchasePrice) - (a.closingQuantity * a.purchasePrice))
    .slice(0, 5);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [monthPurchases, monthSales] = await Promise.all([
    Purchase.find({ firm: req.firmId, date: { $gte: startOfMonth } }).lean(),
    Sale.find({ firm: req.firmId, date: { $gte: startOfMonth } }).lean(),
  ]);

  const profit = (stats?.monthlySales || 0) - (stats?.monthlyPurchases || 0);

  const messages = [
    {
      role: 'system',
      content: `You are a smart business analyst for an Indian business. Generate a concise, insightful 3-5 sentence summary of the business's current status. 
Use plain English. Mention key metrics, highlight concerns (low stock, low sales), and give one actionable recommendation. 
Use Indian Rupee ₹ symbol. Be direct and helpful. Do NOT use bullet points or headers — just flowing sentences.`
    },
    {
      role: 'user',
      content: `Business snapshot for ${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}:
- Total Stock Items: ${stats?.totalItems || items.length}
- Total Stock Value: ₹${(stats?.totalStockValue || 0).toFixed(2)}
- Out of Stock Items: ${stats?.lowStockItems || lowStockItems.length}
- This Month Purchases: ₹${(stats?.monthlyPurchases || 0).toFixed(2)} (${monthPurchases.length} transactions)
- This Month Sales: ₹${(stats?.monthlySales || 0).toFixed(2)} (${monthSales.length} transactions)
- Estimated Profit This Month: ₹${profit.toFixed(2)}
- Low Stock Items: ${lowStockItems.slice(0, 5).map(i => `${i.itemName} (${i.closingQuantity} left)`).join(', ') || 'None'}
- Top Value Items: ${topItems.map(i => `${i.itemName} (₹${(i.closingQuantity * i.purchasePrice).toFixed(0)})`).join(', ')}`
    }
  ];

  const summary = await groqChat({ messages, model: 'llama-3.1-8b-instant', maxTokens: 350, userId: req.user?._id });
  aiCache.set(cacheKey, summary, TTL_DASHBOARD); // Cache 6 hours
  res.json({ success: true, data: { summary } });
});

/* ─────────────────────────────────────────────────────────────
   5. Payment Reminder Generator
   POST /api/ai/payment-reminder
   Body: { customerName: string, balance: number, phone?: string, customerId?: string }

   Strategy: Backend assembles the ENTIRE message structure with
   exact financial data. AI only writes ONE natural-language sentence
   describing the products purchased. This prevents hallucinated firm
   names, wrong amounts, and garbled repetition.
   ───────────────────────────────────────────────────────────── */
const aiPaymentReminder = asyncHandler(async (req, res) => {
  const { customerName, balance, phone, customerId } = req.body;
  if (!customerName || !balance) return res.status(400).json({ success: false, message: 'Customer name and balance are required' });

  // 1. Firm details from req.firm — set by firmMiddleware, never touched by AI
  const firmName  = req.firm?.name  || req.firm?.firmName || '';
  const firmPhone = req.firm?.phone || req.firm?.firmPhone || '';

  // 2. Fetch customer's recent sales
  let invoiceBreakdownLines = [];   // "Invoice INV-XXX: ₹YYY"
  let productDescParts      = [];   // for the AI's single prose sentence
  const customerFirstName   = customerName.split(' ')[0];

  try {
    const salesQuery = { firm: req.firmId };
    if (customerId) {
      salesQuery.customer = customerId;
    } else {
      salesQuery.customerName = { $regex: customerName, $options: 'i' };
    }

    const recentSales = await Sale.find(salesQuery).sort({ date: -1 }).limit(5).lean();

    recentSales.forEach(sale => {
      // Exact invoice amount from DB — never recalculated
      const invoiceAmt = Number(sale.totalAmount || 0).toFixed(2);
      invoiceBreakdownLines.push(`Invoice ${sale.invoiceNumber}: \u20b9${invoiceAmt}`);

      // Product descriptions for the AI sentence
      (sale.items || []).forEach(item => {
        productDescParts.push(
          `${item.quantity} units of ${item.itemName} at \u20b9${Number(item.rate).toFixed(2)} each (Invoice ${sale.invoiceNumber})`
        );
      });
    });
  } catch {}

  // 3. AI writes ONLY a single product-description sentence
  //    Everything else (amounts, names, invoice numbers) is assembled by backend code.
  let productSentence = '';
  if (productDescParts.length > 0) {
    try {
      const aiMessages = [
        {
          role: 'system',
          content: `You write ONE single sentence (max 30 words) that lists the products a customer has purchased.
Rules:
- Start the sentence with "We have provided you with"
- List all products naturally (use "including" and "and")
- Include quantities, item names, rates, and invoice numbers exactly as given
- Do NOT add any amounts, totals, firm names, or extra commentary
- Plain text only, no punctuation at the end other than a full stop`
        },
        {
          role: 'user',
          content: `Products: ${productDescParts.slice(0, 8).join('; ')}`
        }
      ];
      productSentence = await groqChat({ messages: aiMessages, model: 'llama-3.1-8b-instant', maxTokens: 80, userId: req.user?._id });
      productSentence = productSentence.trim().replace(/\.$/, '');
    } catch {
      productSentence = `We have provided you with ${productDescParts.slice(0, 3).map(p => p.split(' (')[0]).join(', ')}`;
    }
  }

  // 4. Backend assembles the COMPLETE message — no AI involvement for structure or numbers
  const balanceStr      = `\u20b9${Number(balance).toFixed(2)}`;
  const invoiceBlock    = invoiceBreakdownLines.length
    ? invoiceBreakdownLines.join('\n')
    : '(No invoice details found)';

  const message = [
    `Dear ${customerFirstName}`,
    '',
    `This is a payment reminder from ${firmName} regarding your outstanding balance of ${balanceStr}. ${productSentence}.`,
    '',
    `We kindly request that you settle this outstanding amount at your earliest convenience. Please find the details of your outstanding payment below:`,
    '',
    invoiceBlock,
    '',
    `We appreciate your prompt attention to this matter and look forward to receiving the payment soon.`,
    '',
    `Thank you for your cooperation.`,
    '',
    `Best regards,`,
    firmName,
    ...(firmPhone ? [firmPhone] : []),
  ].join('\n');

  res.json({ success: true, data: { message } });
});

module.exports = { aiChat, aiHsnSuggest, aiAnomalyCheck, aiReportSummary, aiPaymentReminder };
