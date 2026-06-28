
/* ─── Amount in Words (Indian system) ──────────────────────── */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}
function below1000(n) {
  return n < 100 ? below100(n) : ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '');
}
function convertIndian(n) {
  if (n === 0) return '';
  if (n < 1000)       return below1000(n);
  if (n < 100000)     return below1000(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + below1000(n % 1000) : '');
  if (n < 10000000)   return below1000(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convertIndian(n % 100000) : '');
  return below1000(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convertIndian(n % 10000000) : '');
}
export function amountInWords(amount) {
  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  let result = (convertIndian(rupees) || 'Zero') + ' Rupees';
  if (paise > 0) result += ' and ' + below100(paise) + ' Paise';
  return result + ' Only';
}

/* ─── HSN Summary from items array ─────────────────────────── */
export function buildHsnSummary(items) {
  const map = {};
  (items || []).forEach(item => {
    const key = `${item.hsnCode}__${item.gstPercentage}`;
    if (!map[key]) {
      map[key] = {
        hsnCode:      item.hsnCode,
        gstRate:      item.gstPercentage,
        taxableValue: 0,
        cgst:         0,
        sgst:         0,
        igst:         0,
        totalTax:     0,
      };
    }
    map[key].taxableValue += item.taxableAmount || 0;
    map[key].cgst         += item.cgst          || 0;
    map[key].sgst         += item.sgst          || 0;
    map[key].igst         += item.igst          || 0;
    map[key].totalTax     += item.totalTax      || 0;
  });
  return Object.values(map);
}

/* ─── formatCurrency helper (no React dependency) ───────────── */
function fc(v) {
  return 'Rs. ' + (v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ─── Main print function ───────────────────────────────────── */
export function printGSTInvoice(sale, firm) {
  const BUSINESS = {
    name: firm?.name ?? '',
    address: firm?.address ?? '',
    pincode: firm?.pincode ?? '',
    gstin: firm?.gstin ?? '',
    phone: firm?.phone ?? '',
    email: firm?.email ?? '',
    state: firm?.state ?? '',
    stateCode: firm?.stateCode ?? '',
  };
  const isInterState = sale.isInterState;
  const hsnList      = buildHsnSummary(sale.items);

  // Helper: get date string
  const dateStr = sale.date
    ? new Date(sale.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  /* ── item rows ─────────────────────────────────────────── */
  const itemRows = (sale.items || []).map((item, i) => {
    if (isInterState) {
      return `
        <tr>
          <td class="tc">${i + 1}</td>
          <td><b>${item.itemName}</b><br><span class="sm">${item.packingSize || ''}</span></td>
          <td class="tc">${item.hsnCode}</td>
          <td class="tr">${item.quantity}</td>
          <td class="tr">${fc(item.rate)}</td>
          <td class="tr">${fc(item.taxableAmount)}</td>
          <td class="tc">${item.gstPercentage}%</td>
          <td class="tr">${fc(item.igst)}</td>
          <td class="tr b">${fc(item.amount)}</td>
        </tr>`;
    }
    return `
      <tr>
        <td class="tc">${i + 1}</td>
        <td><b>${item.itemName}</b><br><span class="sm">${item.packingSize || ''}</span></td>
        <td class="tc">${item.hsnCode}</td>
        <td class="tr">${item.quantity}</td>
        <td class="tr">${fc(item.rate)}</td>
        <td class="tr">${fc(item.taxableAmount)}</td>
        <td class="tc">${item.gstPercentage / 2}%</td>
        <td class="tr">${fc(item.cgst)}</td>
        <td class="tc">${item.gstPercentage / 2}%</td>
        <td class="tr">${fc(item.sgst)}</td>
        <td class="tr b">${fc(item.amount)}</td>
      </tr>`;
  }).join('');

  /* ── items table header ────────────────────────────────── */
  const itemHeader = isInterState ? `
    <tr>
      <th class="tc">Sr.</th>
      <th>Description of Goods</th>
      <th class="tc">HSN / SAC</th>
      <th class="tr">Qty</th>
      <th class="tr">Rate (Rs.)</th>
      <th class="tr">Taxable Value</th>
      <th class="tc">IGST %</th>
      <th class="tr">IGST Amt</th>
      <th class="tr">Total</th>
    </tr>` : `
    <tr>
      <th class="tc">Sr.</th>
      <th>Description of Goods</th>
      <th class="tc">HSN / SAC</th>
      <th class="tr">Qty</th>
      <th class="tr">Rate (Rs.)</th>
      <th class="tr">Taxable Value</th>
      <th class="tc">CGST %</th>
      <th class="tr">CGST Amt</th>
      <th class="tc">SGST %</th>
      <th class="tr">SGST Amt</th>
      <th class="tr">Total</th>
    </tr>`;

  const colSpan = isInterState ? 9 : 11;

  /* ── HSN summary rows ──────────────────────────────────── */
  const hsnRows = hsnList.map(h => {
    if (isInterState) {
      return `
        <tr>
          <td class="tc b">${h.hsnCode}</td>
          <td class="tr">${fc(h.taxableValue)}</td>
          <td class="tc">${h.gstRate}%</td>
          <td class="tr">${fc(h.igst)}</td>
          <td class="tr b">${fc(h.totalTax)}</td>
        </tr>`;
    }
    return `
      <tr>
        <td class="tc b">${h.hsnCode}</td>
        <td class="tr">${fc(h.taxableValue)}</td>
        <td class="tc">${h.gstRate / 2}%</td>
        <td class="tr">${fc(h.cgst)}</td>
        <td class="tc">${h.gstRate / 2}%</td>
        <td class="tr">${fc(h.sgst)}</td>
        <td class="tr b">${fc(h.totalTax)}</td>
      </tr>`;
  }).join('');

  const hsnTotals = hsnList.reduce((acc, h) => {
    acc.taxableValue += h.taxableValue;
    acc.cgst   += h.cgst;
    acc.sgst   += h.sgst;
    acc.igst   += h.igst;
    acc.totalTax += h.totalTax;
    return acc;
  }, { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });

  const hsnTotalRow = isInterState ? `
    <tr class="totrow">
      <td class="tc b">Total</td>
      <td class="tr b">${fc(hsnTotals.taxableValue)}</td>
      <td></td>
      <td class="tr b">${fc(hsnTotals.igst)}</td>
      <td class="tr b">${fc(hsnTotals.totalTax)}</td>
    </tr>` : `
    <tr class="totrow">
      <td class="tc b">Total</td>
      <td class="tr b">${fc(hsnTotals.taxableValue)}</td>
      <td></td>
      <td class="tr b">${fc(hsnTotals.cgst)}</td>
      <td></td>
      <td class="tr b">${fc(hsnTotals.sgst)}</td>
      <td class="tr b">${fc(hsnTotals.totalTax)}</td>
    </tr>`;

  const hsnHeader = isInterState ? `
    <tr>
      <th class="tc">HSN / SAC</th>
      <th class="tr">Taxable Value</th>
      <th class="tc">Integrated Tax Rate</th>
      <th class="tr">Integrated Tax Amount</th>
      <th class="tr">Total Tax</th>
    </tr>` : `
    <tr>
      <th class="tc">HSN / SAC</th>
      <th class="tr">Taxable Value</th>
      <th class="tc">Central Tax Rate</th>
      <th class="tr">Central Tax Amount</th>
      <th class="tc">State Tax Rate</th>
      <th class="tr">State Tax Amount</th>
      <th class="tr">Total Tax</th>
    </tr>`;

  /* ── Tax summary in totals block ───────────────────────── */
  const taxLines = isInterState
    ? `<div class="tot-row"><span>IGST</span><span>${fc(sale.totalIgst)}</span></div>`
    : `<div class="tot-row"><span>CGST</span><span>${fc(sale.totalCgst)}</span></div>
       <div class="tot-row"><span>SGST / UTGST</span><span>${fc(sale.totalSgst)}</span></div>`;

  /* ── Full HTML ─────────────────────────────────────────── */
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice — ${sale.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #111; background: #fff; }

    /* ── Page ─────────────────────────────────── */
    .invoice { max-width: 210mm; margin: 0 auto; padding: 12mm 14mm; }
    @media print {
      body { margin: 0; }
      .invoice { padding: 8mm 10mm; max-width: 100%; }
      .no-print { display: none !important; }
    }

    /* ── Outer border ─────────────────────────── */
    .outer-box { border: 1.5px solid #111; }

    /* ── Title bar ────────────────────────────── */
    .title-bar {
      text-align: center;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 4px;
      text-transform: uppercase;
      padding: 6px 0;
      border-bottom: 1.5px solid #111;
      background: #052e16;
      color: #fff;
    }

    /* ── Two column row ───────────────────────── */
    .two-col { display: flex; border-bottom: 1px solid #111; }
    .two-col .left  { flex: 1; padding: 10px 12px; border-right: 1px solid #111; }
    .two-col .right { flex: 1; padding: 10px 12px; }
    .two-col.border-top { border-top: 1px solid #111; }

    /* ── Party block ──────────────────────────── */
    .biz-name { font-size: 14px; font-weight: 800; color: #052e16; }
    .biz-detail { font-size: 10.5px; color: #374151; margin-top: 2px; line-height: 1.6; }
    .gstin-tag { font-weight: 700; color: #111; }
    .sec-label {
      font-size: 9px; text-transform: uppercase; letter-spacing: 1px;
      color: #6b7280; font-weight: 700; margin-bottom: 5px;
    }

    /* ── Invoice meta ─────────────────────────── */
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table td { padding: 3px 0; font-size: 11px; }
    .meta-table td:first-child { width: 110px; color: #6b7280; }
    .meta-table td:last-child  { font-weight: 600; }

    /* ── Items table ──────────────────────────── */
    .tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
    .tbl th {
      background: #052e16; color: #fff;
      padding: 6px 8px; font-size: 10px; font-weight: 700;
      border: 1px solid #111; text-align: left;
    }
    .tbl td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
    .tbl tbody tr:last-child td { border-bottom: 1px solid #111; }
    .tbl tfoot td { border: 1px solid #111; }
    .tc { text-align: center; }
    .tr { text-align: right; }
    .b  { font-weight: 700; }
    .sm { font-size: 9.5px; color: #6b7280; }
    .totrow { background: #f0fdf4; font-weight: 700; }

    /* ── Totals section ───────────────────────── */
    .totals-outer { display: flex; border-top: 1px solid #111; }
    .words-box { flex: 1; padding: 10px 12px; border-right: 1px solid #111; }
    .words-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 4px; }
    .words-text  { font-size: 11px; font-weight: 600; font-style: italic; line-height: 1.5; }
    .totals-box  { min-width: 220px; padding: 10px 12px; }
    .tot-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11.5px; }
    .tot-row.grand {
      font-size: 13px; font-weight: 800; color: #052e16;
      border-top: 1.5px solid #052e16; margin-top: 6px; padding-top: 6px;
    }

    /* ── HSN Summary ──────────────────────────── */
    .hsn-title {
      background: #f0fdf4; border-top: 1.5px solid #111; border-bottom: 1px solid #111;
      font-size: 10px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1.5px; padding: 5px 12px; color: #052e16;
    }

    /* ── Footer ───────────────────────────────── */
    .footer-outer { display: flex; border-top: 1px solid #111; }
    .declaration  { flex: 1; padding: 10px 12px; border-right: 1px solid #111; font-size: 10px; color: #374151; line-height: 1.7; }
    .sig-box      { min-width: 180px; padding: 10px 12px; text-align: center; }
    .sig-line     { border-top: 1px solid #111; margin-top: 38px; font-size: 10px; color: #374151; padding-top: 4px; }
    .sig-biz      { font-weight: 700; font-size: 11px; }

    /* ── Print button ─────────────────────────── */
    .print-btn-bar {
      display: flex; justify-content: center; gap: 12px;
      padding: 16px; background: #f9fafb; border-top: 1px solid #e5e7eb;
    }
    .btn-print { background: #16a34a; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
    .btn-close { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>

<div class="no-print print-btn-bar">
  <button class="btn-print" onclick="window.print()">Print Invoice</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>

<div class="invoice">
  <div class="outer-box">

    <!-- ① Title bar -->
    <div class="title-bar">Tax Invoice</div>

    <!-- ② Header: Seller | Invoice Details -->
    <div class="two-col">
      <div class="left">
        <div class="sec-label">Seller / Supplier</div>
        <div class="biz-name">${BUSINESS.name}</div>
        <div class="biz-detail">
          ${BUSINESS.address}${BUSINESS.pincode ? ', ' + BUSINESS.pincode : ''}<br>
          <span class="gstin-tag">GSTIN:</span> ${BUSINESS.gstin}<br>
          ${BUSINESS.phone ? 'Ph: ' + BUSINESS.phone : ''}${BUSINESS.email ? ' &nbsp;|&nbsp; ' + BUSINESS.email : ''}
        </div>
      </div>
      <div class="right">
        <table class="meta-table">
          <tr><td>Invoice No.</td><td>${sale.invoiceNumber}</td></tr>
          <tr><td>Invoice Date</td><td>${dateStr}</td></tr>
          <tr><td>Place of Supply</td><td>${BUSINESS.state} (${BUSINESS.stateCode})</td></tr>
          <tr><td>Reverse Charge</td><td>No</td></tr>
          <tr><td>Supply Type</td><td>${isInterState ? 'Inter-State' : 'Intra-State'}</td></tr>
        </table>
      </div>
    </div>

    <!-- ③ Buyer Details -->
    <div class="two-col">
      <div class="left" style="flex:1">
        <div class="sec-label">Bill To / Buyer</div>
        <div class="biz-name">${sale.customerName}</div>
        <div class="biz-detail">
          ${sale.customerAddress ? sale.customerAddress + '<br>' : ''}
          <span class="gstin-tag">GSTIN:</span> ${sale.customerGST === 'CASH' ? 'Unregistered (Retail / Cash)' : sale.customerGST}
          ${sale.customerPhone ? '<br>Ph: ' + sale.customerPhone : ''}
        </div>
      </div>
      <div class="right" style="flex:1; display:flex; align-items:flex-end; justify-content:flex-end;">
        <div style="text-align:right">
          <div class="sec-label">Total Invoice Value</div>
          <div style="font-size:20px;font-weight:800;color:#16a34a;">${fc(sale.totalAmount)}</div>
        </div>
      </div>
    </div>

    <!-- ④ Items Table -->
    <table class="tbl">
      <thead>${itemHeader}</thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- ⑤ Totals + Amount in Words -->
    <div class="totals-outer">
      <div class="words-box">
        <div class="words-label">Amount in Words</div>
        <div class="words-text">${amountInWords(sale.totalAmount)}</div>
      </div>
      <div class="totals-box">
        <div class="tot-row"><span>Taxable Amount</span><span>${fc(sale.subtotal)}</span></div>
        ${taxLines}
        <div class="tot-row"><span>Total Tax</span><span>${fc(sale.totalTax)}</span></div>
        <div class="tot-row grand"><span>Grand Total</span><span>${fc(sale.totalAmount)}</span></div>
      </div>
    </div>

    <!-- ⑥ HSN-wise Tax Summary -->
    <div class="hsn-title">HSN / SAC-wise Tax Summary</div>
    <table class="tbl" style="margin:0">
      <thead>${hsnHeader}</thead>
      <tbody>${hsnRows}</tbody>
      <tfoot>${hsnTotalRow}</tfoot>
    </table>

    <!-- ⑦ Footer: Declaration + Signature -->
    <div class="footer-outer">
      <div class="declaration">
        <b>Declaration:</b><br>
        We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        All disputes are subject to jurisdiction of ${BUSINESS.state} courts only.
      </div>
      <div class="sig-box">
        <div class="sig-biz">${BUSINESS.name}</div>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>

  </div><!-- /outer-box -->
</div><!-- /invoice -->

</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=800');
  win.document.write(html);
  win.document.close();
  win.focus();
  // Auto-trigger print after render
  win.addEventListener('load', () => {
    setTimeout(() => win.print(), 300);
  });
}

/* ─── Purchase Receipt function ─────────────────────────────── */
export function printPurchaseReceipt(purchase, firm) {
  const BUSINESS = {
    name: firm?.name ?? '',
    address: firm?.address ?? '',
    pincode: firm?.pincode ?? '',
    gstin: firm?.gstin ?? '',
    phone: firm?.phone ?? '',
    email: firm?.email ?? '',
    state: firm?.state ?? '',
    stateCode: firm?.stateCode ?? '',
  };
  const isInterState = purchase.isInterState;
  const hsnList      = buildHsnSummary(purchase.items);

  const dateStr = purchase.date
    ? new Date(purchase.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  /* item rows */
  const itemRows = (purchase.items || []).map((item, i) => {
    if (isInterState) {
      return `<tr>
        <td class="tc">${i + 1}</td>
        <td><b>${item.itemName}</b><br><span class="sm">${item.packingSize || ''}</span></td>
        <td class="tc">${item.hsnCode}</td>
        <td class="tr">${item.quantity}</td>
        <td class="tr">${fc(item.rate)}</td>
        <td class="tr">${fc(item.taxableAmount)}</td>
        <td class="tc">${item.gstPercentage}%</td>
        <td class="tr">${fc(item.igst)}</td>
        <td class="tr b">${fc(item.amount)}</td>
      </tr>`;
    }
    return `<tr>
      <td class="tc">${i + 1}</td>
      <td><b>${item.itemName}</b><br><span class="sm">${item.packingSize || ''}</span></td>
      <td class="tc">${item.hsnCode}</td>
      <td class="tr">${item.quantity}</td>
      <td class="tr">${fc(item.rate)}</td>
      <td class="tr">${fc(item.taxableAmount)}</td>
      <td class="tc">${item.gstPercentage / 2}%</td>
      <td class="tr">${fc(item.cgst)}</td>
      <td class="tc">${item.gstPercentage / 2}%</td>
      <td class="tr">${fc(item.sgst)}</td>
      <td class="tr b">${fc(item.amount)}</td>
    </tr>`;
  }).join('');

  const itemHeader = isInterState ? `<tr>
    <th class="tc">Sr.</th><th>Description</th><th class="tc">HSN</th>
    <th class="tr">Qty</th><th class="tr">Rate</th><th class="tr">Taxable</th>
    <th class="tc">IGST %</th><th class="tr">IGST Amt</th><th class="tr">Total</th>
  </tr>` : `<tr>
    <th class="tc">Sr.</th><th>Description</th><th class="tc">HSN</th>
    <th class="tr">Qty</th><th class="tr">Rate</th><th class="tr">Taxable</th>
    <th class="tc">CGST %</th><th class="tr">CGST Amt</th>
    <th class="tc">SGST %</th><th class="tr">SGST Amt</th><th class="tr">Total</th>
  </tr>`;

  /* HSN summary */
  const hsnRows = hsnList.map(h => isInterState
    ? `<tr><td class="tc b">${h.hsnCode}</td><td class="tr">${fc(h.taxableValue)}</td><td class="tc">${h.gstRate}%</td><td class="tr">${fc(h.igst)}</td><td class="tr b">${fc(h.totalTax)}</td></tr>`
    : `<tr><td class="tc b">${h.hsnCode}</td><td class="tr">${fc(h.taxableValue)}</td><td class="tc">${h.gstRate / 2}%</td><td class="tr">${fc(h.cgst)}</td><td class="tc">${h.gstRate / 2}%</td><td class="tr">${fc(h.sgst)}</td><td class="tr b">${fc(h.totalTax)}</td></tr>`
  ).join('');

  const hsnTotals = hsnList.reduce((a, h) => ({
    taxableValue: a.taxableValue + h.taxableValue, cgst: a.cgst + h.cgst,
    sgst: a.sgst + h.sgst, igst: a.igst + h.igst, totalTax: a.totalTax + h.totalTax,
  }), { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });

  const hsnTotalRow = isInterState
    ? `<tr class="totrow"><td class="tc b">Total</td><td class="tr b">${fc(hsnTotals.taxableValue)}</td><td></td><td class="tr b">${fc(hsnTotals.igst)}</td><td class="tr b">${fc(hsnTotals.totalTax)}</td></tr>`
    : `<tr class="totrow"><td class="tc b">Total</td><td class="tr b">${fc(hsnTotals.taxableValue)}</td><td></td><td class="tr b">${fc(hsnTotals.cgst)}</td><td></td><td class="tr b">${fc(hsnTotals.sgst)}</td><td class="tr b">${fc(hsnTotals.totalTax)}</td></tr>`;

  const hsnHeader = isInterState
    ? `<tr><th class="tc">HSN</th><th class="tr">Taxable Value</th><th class="tc">IGST Rate</th><th class="tr">IGST Amount</th><th class="tr">Total Tax</th></tr>`
    : `<tr><th class="tc">HSN</th><th class="tr">Taxable Value</th><th class="tc">CGST Rate</th><th class="tr">CGST Amt</th><th class="tc">SGST Rate</th><th class="tr">SGST Amt</th><th class="tr">Total Tax</th></tr>`;

  const taxLines = isInterState
    ? `<div class="tot-row"><span>IGST</span><span>${fc(purchase.totalIgst)}</span></div>`
    : `<div class="tot-row"><span>CGST</span><span>${fc(purchase.totalCgst)}</span></div>
       <div class="tot-row"><span>SGST / UTGST</span><span>${fc(purchase.totalSgst)}</span></div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Receipt — ${purchase.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #111; background: #fff; }
    .invoice { max-width: 210mm; margin: 0 auto; padding: 12mm 14mm; }
    @media print { body { margin: 0; } .invoice { padding: 8mm 10mm; max-width: 100%; } .no-print { display: none !important; } }
    .outer-box { border: 1.5px solid #111; }
    .title-bar { text-align: center; font-size: 14px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; padding: 6px 0; border-bottom: 1.5px solid #111; background: #052e16; color: #fff; }
    .two-col { display: flex; border-bottom: 1px solid #111; }
    .two-col .left  { flex: 1; padding: 10px 12px; border-right: 1px solid #111; }
    .two-col .right { flex: 1; padding: 10px 12px; }
    .biz-name { font-size: 14px; font-weight: 800; color: #052e16; }
    .biz-detail { font-size: 10.5px; color: #374151; margin-top: 2px; line-height: 1.6; }
    .gstin-tag { font-weight: 700; color: #111; }
    .sec-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 5px; }
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table td { padding: 3px 0; font-size: 11px; }
    .meta-table td:first-child { width: 110px; color: #6b7280; }
    .meta-table td:last-child  { font-weight: 600; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
    .tbl th { background: #052e16; color: #fff; padding: 6px 8px; font-size: 10px; font-weight: 700; border: 1px solid #111; text-align: left; }
    .tbl td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
    .tbl tbody tr:last-child td { border-bottom: 1px solid #111; }
    .tbl tfoot td { border: 1px solid #111; }
    .tc { text-align: center; } .tr { text-align: right; } .b { font-weight: 700; }
    .sm { font-size: 9.5px; color: #6b7280; }
    .totrow { background: #f0fdf4; font-weight: 700; }
    .totals-outer { display: flex; border-top: 1px solid #111; }
    .words-box { flex: 1; padding: 10px 12px; border-right: 1px solid #111; }
    .words-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 4px; }
    .words-text { font-size: 11px; font-weight: 600; font-style: italic; line-height: 1.5; }
    .totals-box { min-width: 220px; padding: 10px 12px; }
    .tot-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11.5px; }
    .tot-row.grand { font-size: 13px; font-weight: 800; color: #052e16; border-top: 1.5px solid #052e16; margin-top: 6px; padding-top: 6px; }
    .hsn-title { background: #f0fdf4; border-top: 1.5px solid #111; border-bottom: 1px solid #111; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 5px 12px; color: #052e16; }
    .footer-outer { display: flex; border-top: 1px solid #111; }
    .declaration { flex: 1; padding: 10px 12px; border-right: 1px solid #111; font-size: 10px; color: #374151; line-height: 1.7; }
    .sig-box { min-width: 180px; padding: 10px 12px; text-align: center; }
    .sig-line { border-top: 1px solid #111; margin-top: 38px; font-size: 10px; color: #374151; padding-top: 4px; }
    .sig-biz { font-weight: 700; font-size: 11px; }
    .print-btn-bar { display: flex; justify-content: center; gap: 12px; padding: 16px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .btn-print { background: #16a34a; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
    .btn-close { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
<div class="no-print print-btn-bar">
  <button class="btn-print" onclick="window.print()">Print Receipt</button>
  <button class="btn-close" onclick="window.close()">Close</button>
</div>
<div class="invoice">
  <div class="outer-box">
    <div class="title-bar">Purchase Receipt</div>

    <!-- Header: Buyer (us) | Receipt Details -->
    <div class="two-col">
      <div class="left">
        <div class="sec-label">Purchased By</div>
        <div class="biz-name">${BUSINESS.name}</div>
        <div class="biz-detail">
          ${BUSINESS.address}${BUSINESS.pincode ? ', ' + BUSINESS.pincode : ''}<br>
          <span class="gstin-tag">GSTIN:</span> ${BUSINESS.gstin}<br>
          ${BUSINESS.phone ? 'Ph: ' + BUSINESS.phone : ''}
        </div>
      </div>
      <div class="right">
        <table class="meta-table">
          <tr><td>Invoice No.</td><td>${purchase.invoiceNumber}</td></tr>
          <tr><td>Invoice Date</td><td>${dateStr}</td></tr>
          <tr><td>Supply Type</td><td>${isInterState ? 'Inter-State' : 'Intra-State'}</td></tr>
          <tr><td>Reverse Charge</td><td>No</td></tr>
        </table>
      </div>
    </div>

    <!-- Supplier Details -->
    <div class="two-col">
      <div class="left" style="flex:1">
        <div class="sec-label">Supplier / Seller</div>
        <div class="biz-name">${purchase.supplierName}</div>
        <div class="biz-detail">
          ${purchase.supplierAddress ? purchase.supplierAddress + '<br>' : ''}
          <span class="gstin-tag">GSTIN:</span> ${purchase.supplierGST}
          ${purchase.supplierPhone ? '<br>Ph: ' + purchase.supplierPhone : ''}
        </div>
      </div>
      <div class="right" style="flex:1; display:flex; align-items:flex-end; justify-content:flex-end;">
        <div style="text-align:right">
          <div class="sec-label">Total Purchase Value</div>
          <div style="font-size:20px;font-weight:800;color:#16a34a;">${fc(purchase.totalAmount)}</div>
        </div>
      </div>
    </div>

    <!-- Items -->
    <table class="tbl">
      <thead>${itemHeader}</thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals + Amount in Words -->
    <div class="totals-outer">
      <div class="words-box">
        <div class="words-label">Amount in Words</div>
        <div class="words-text">${amountInWords(purchase.totalAmount)}</div>
      </div>
      <div class="totals-box">
        <div class="tot-row"><span>Taxable Amount</span><span>${fc(purchase.subtotal)}</span></div>
        ${taxLines}
        <div class="tot-row"><span>Total Tax</span><span>${fc(purchase.totalTax)}</span></div>
        <div class="tot-row grand"><span>Grand Total</span><span>${fc(purchase.totalAmount)}</span></div>
      </div>
    </div>

    <!-- HSN Summary -->
    <div class="hsn-title">HSN / SAC-wise Tax Summary</div>
    <table class="tbl" style="margin:0">
      <thead>${hsnHeader}</thead>
      <tbody>${hsnRows}</tbody>
      <tfoot>${hsnTotalRow}</tfoot>
    </table>

    <!-- Footer -->
    <div class="footer-outer">
      <div class="declaration">
        <b>Note:</b><br>
        This is a purchase receipt for internal records. Goods received as per above details.
        All disputes are subject to jurisdiction of ${BUSINESS.state} courts only.
      </div>
      <div class="sig-box">
        <div class="sig-biz">${BUSINESS.name}</div>
        <div class="sig-line">Authorised Signatory</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=800');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.addEventListener('load', () => { setTimeout(() => win.print(), 300); });
}

