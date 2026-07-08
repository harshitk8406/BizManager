
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
  return 'Rs. ' + Number(v || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ─── Shared CSS for both invoice and receipt ───────────────── */
function sharedCSS() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page size selector (screen only) ── */
    .no-print { }
    .print-controls {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 14px 20px;
      background: #f9fafb; border-bottom: 1px solid #e5e7eb;
      font-family: Arial, sans-serif; font-size: 13px;
    }
    .print-controls label { font-weight: 600; color: #374151; }
    .print-controls select {
      padding: 6px 12px; border-radius: 6px; border: 1px solid #d1d5db;
      font-size: 13px; background: #fff; cursor: pointer;
    }
    .btn-print {
      background: #16a34a; color: #fff; border: none;
      padding: 9px 26px; border-radius: 8px;
      font-weight: 700; font-size: 14px; cursor: pointer;
    }
    .btn-close {
      background: #f3f4f6; color: #374151;
      border: 1px solid #d1d5db; padding: 9px 20px;
      border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer;
    }

    /* ── Body & page ── */
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #111;
      background: #fff;
    }

    /* ── Invoice wrapper: fluid width, respects paper ── */
    .invoice {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 10mm 12mm;
    }

    /* ── Outer border ── */
    .outer-box { border: 1.5px solid #111; width: 100%; }

    /* ── Title bar ── */
    .title-bar {
      text-align: center;
      font-size: 13px; font-weight: 800;
      letter-spacing: 4px; text-transform: uppercase;
      padding: 6px 0;
      border-bottom: 1.5px solid #111;
      background: #052e16; color: #fff;
    }

    /* ── Two-column layout using table for print compatibility ── */
    .two-col { display: table; width: 100%; border-collapse: collapse; border-bottom: 1px solid #111; }
    .two-col .left  { display: table-cell; width: 55%; padding: 9px 11px; border-right: 1px solid #111; vertical-align: top; }
    .two-col .right { display: table-cell; width: 45%; padding: 9px 11px; vertical-align: top; }
    .two-col.right-align .right { vertical-align: bottom; text-align: right; }

    /* ── Party block ── */
    .biz-name   { font-size: 13px; font-weight: 800; color: #052e16; word-break: break-word; }
    .biz-detail { font-size: 10px; color: #374151; margin-top: 2px; line-height: 1.6; word-break: break-word; }
    .gstin-tag  { font-weight: 700; color: #111; }
    .sec-label  { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 4px; }

    /* ── Invoice meta table ── */
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table td { padding: 3px 0; font-size: 10.5px; }
    .meta-table td:first-child { width: 100px; color: #6b7280; white-space: nowrap; }
    .meta-table td:last-child  { font-weight: 600; word-break: break-word; }

    /* ── Items table ── */
    .tbl { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
    .tbl th {
      background: #052e16; color: #fff;
      padding: 5px 6px; font-size: 9.5px; font-weight: 700;
      border: 1px solid #111; text-align: left;
      word-wrap: break-word; overflow-wrap: break-word;
    }
    .tbl td {
      padding: 4px 6px; border: 1px solid #ddd;
      vertical-align: top; word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .tbl tbody tr:last-child td { border-bottom: 1px solid #111; }
    .tbl tfoot td { border: 1px solid #111; }
    .tc { text-align: center; }
    .tr { text-align: right; }
    .b  { font-weight: 700; }
    .sm { font-size: 9px; color: #6b7280; }
    .totrow { background: #f0fdf4; font-weight: 700; }

    /* ── Totals section (table-based for print) ── */
    .totals-outer { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #111; }
    .words-box {
      display: table-cell; width: 58%;
      padding: 9px 11px; border-right: 1px solid #111;
      vertical-align: top;
    }
    .words-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 3px; }
    .words-text  { font-size: 10.5px; font-weight: 600; font-style: italic; line-height: 1.5; word-break: break-word; }
    .totals-box  { display: table-cell; width: 42%; padding: 9px 11px; vertical-align: top; }
    .tot-row {
      display: table; width: 100%;
      border-collapse: collapse;
      padding: 2px 0; font-size: 10.5px;
    }
    .tot-row span:first-child { display: table-cell; text-align: left; }
    .tot-row span:last-child  { display: table-cell; text-align: right; font-weight: 600; white-space: nowrap; }
    .tot-row.grand {
      font-size: 12px; font-weight: 800; color: #052e16;
      border-top: 1.5px solid #052e16; margin-top: 5px; padding-top: 5px;
    }
    .tot-row.roundoff { color: #d97706; }

    /* ── HSN Summary ── */
    .hsn-title {
      background: #f0fdf4; border-top: 1.5px solid #111; border-bottom: 1px solid #111;
      font-size: 9.5px; font-weight: 800; text-transform: uppercase;
      letter-spacing: 1.5px; padding: 4px 11px; color: #052e16;
    }

    /* ── Footer ── */
    .footer-outer { display: table; width: 100%; border-collapse: collapse; border-top: 1px solid #111; }
    .declaration  { display: table-cell; width: 65%; padding: 9px 11px; border-right: 1px solid #111; font-size: 9.5px; color: #374151; line-height: 1.7; vertical-align: top; word-break: break-word; }
    .sig-box      { display: table-cell; width: 35%; padding: 9px 11px; text-align: center; vertical-align: top; }
    .sig-line     { border-top: 1px solid #111; margin-top: 36px; font-size: 9.5px; color: #374151; padding-top: 4px; }
    .sig-biz      { font-weight: 700; font-size: 10.5px; word-break: break-word; }

    /* ── Print media ── */
    @media print {
      @page {
        margin: 8mm 10mm;
      }
      body { background: #fff !important; color: #111 !important; font-size: 10px; }
      .no-print, .print-controls { display: none !important; }
      .invoice { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
      .outer-box { width: 100% !important; border: 1.5px solid #111 !important; }
      .tbl { font-size: 9px !important; }
      .tbl th { font-size: 8.5px !important; padding: 4px 5px !important; }
      .tbl td { padding: 3px 5px !important; }
      .biz-name { font-size: 12px !important; }
      .title-bar { font-size: 12px !important; letter-spacing: 2px !important; }
      .two-col .left, .two-col .right { padding: 7px 9px !important; }
      .words-box, .totals-box { padding: 7px 9px !important; }
      .declaration, .sig-box { padding: 7px 9px !important; }
      /* keep table rows together where possible */
      tr { page-break-inside: avoid; }
      .outer-box { page-break-inside: avoid; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }
  `;
}

/* ─── Paper size script injected into print window ─────────── */
function paperScript() {
  return `
    <script>
      function setPaper(size) {
        var style = document.getElementById('page-size-style');
        var rules = {
          'a4':     '@page { size: A4 portrait; margin: 8mm 10mm; }',
          'a4-l':   '@page { size: A4 landscape; margin: 8mm 10mm; }',
          'a5':     '@page { size: A5 portrait; margin: 6mm 8mm; }',
          'letter': '@page { size: letter portrait; margin: 10mm 12mm; }',
          'legal':  '@page { size: legal portrait; margin: 10mm 12mm; }',
        };
        style.textContent = rules[size] || rules['a4'];
      }
      // Set default on load
      document.addEventListener('DOMContentLoaded', function() { setPaper('a4'); });
    <\/script>
  `;
}

/* ─── Print controls bar HTML ───────────────────────────────── */
function printControlsBar(btnLabel) {
  return `
    <div class="no-print print-controls">
      <label for="paper-size">Paper Size:</label>
      <select id="paper-size" onchange="setPaper(this.value)">
        <option value="a4">A4 (Portrait)</option>
        <option value="a4-l">A4 (Landscape)</option>
        <option value="a5">A5</option>
        <option value="letter">Letter</option>
        <option value="legal">Legal</option>
      </select>
      <button class="btn-print" onclick="window.print()">${btnLabel}</button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
    <style id="page-size-style">@page { size: A4 portrait; margin: 8mm 10mm; }</style>
  `;
}

/* ─── Main print function ───────────────────────────────────── */
export function printGSTInvoice(sale, firm) {
  const BUSINESS = {
    name:      firm?.name      ?? '',
    address:   firm?.address   ?? '',
    pincode:   firm?.pincode   ?? '',
    gstin:     firm?.gstin     ?? '',
    phone:     firm?.phone     ?? '',
    email:     firm?.email     ?? '',
    state:     firm?.state     ?? '',
    stateCode: firm?.stateCode ?? '',
  };
  const isInterState = sale.isInterState;
  const hsnList      = buildHsnSummary(sale.items);

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

  /* ── items table header ── */
  const itemHeader = isInterState ? `
    <tr>
      <th class="tc" style="width:4%">Sr.</th>
      <th style="width:28%">Description of Goods</th>
      <th class="tc" style="width:10%">HSN/SAC</th>
      <th class="tr" style="width:7%">Qty</th>
      <th class="tr" style="width:12%">Rate</th>
      <th class="tr" style="width:13%">Taxable</th>
      <th class="tc" style="width:7%">IGST%</th>
      <th class="tr" style="width:10%">IGST Amt</th>
      <th class="tr" style="width:9%">Total</th>
    </tr>` : `
    <tr>
      <th class="tc" style="width:4%">Sr.</th>
      <th style="width:24%">Description of Goods</th>
      <th class="tc" style="width:9%">HSN/SAC</th>
      <th class="tr" style="width:6%">Qty</th>
      <th class="tr" style="width:10%">Rate</th>
      <th class="tr" style="width:11%">Taxable</th>
      <th class="tc" style="width:6%">CGST%</th>
      <th class="tr" style="width:9%">CGST</th>
      <th class="tc" style="width:6%">SGST%</th>
      <th class="tr" style="width:9%">SGST</th>
      <th class="tr" style="width:6%">Total</th>
    </tr>`;

  /* ── HSN summary rows ── */
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
      <th class="tc">IGST Rate</th>
      <th class="tr">IGST Amount</th>
      <th class="tr">Total Tax</th>
    </tr>` : `
    <tr>
      <th class="tc">HSN / SAC</th>
      <th class="tr">Taxable Value</th>
      <th class="tc">CGST Rate</th>
      <th class="tr">CGST Amt</th>
      <th class="tc">SGST Rate</th>
      <th class="tr">SGST Amt</th>
      <th class="tr">Total Tax</th>
    </tr>`;

  /* ── Tax summary in totals block ── */
  const taxLines = isInterState
    ? `<div class="tot-row"><span>IGST</span><span>${fc(sale.totalIgst)}</span></div>`
    : `<div class="tot-row"><span>CGST</span><span>${fc(sale.totalCgst)}</span></div>
       <div class="tot-row"><span>SGST / UTGST</span><span>${fc(sale.totalSgst)}</span></div>`;

  // Round-off row
  const rawTotal = (sale.subtotal || 0) + (sale.totalTax || 0);
  const roundOffAmt = (sale.totalAmount || 0) - rawTotal;
  const roundOffRow = Math.abs(roundOffAmt) >= 0.01
    ? `<div class="tot-row roundoff"><span>Round Off</span><span>${roundOffAmt > 0 ? '+' : ''}${fc(roundOffAmt)}</span></div>`
    : '';

  /* ── Full HTML ── */
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice — ${sale.invoiceNumber}</title>
  <style>${sharedCSS()}</style>
  ${paperScript()}
</head>
<body>

${printControlsBar('Print Invoice')}

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
          <tr><td>Place of Supply</td><td>${BUSINESS.state}${BUSINESS.stateCode ? ' (' + BUSINESS.stateCode + ')' : ''}</td></tr>
          <tr><td>Reverse Charge</td><td>No</td></tr>
          <tr><td>Supply Type</td><td>${isInterState ? 'Inter-State' : 'Intra-State'}</td></tr>
        </table>
      </div>
    </div>

    <!-- ③ Buyer Details -->
    <div class="two-col right-align">
      <div class="left">
        <div class="sec-label">Bill To / Buyer</div>
        <div class="biz-name">${sale.customerName}</div>
        <div class="biz-detail">
          ${sale.customerAddress ? sale.customerAddress + '<br>' : ''}
          <span class="gstin-tag">GSTIN:</span> ${sale.customerGST === 'CASH' ? 'Unregistered (Retail / Cash)' : sale.customerGST}
          ${sale.customerPhone ? '<br>Ph: ' + sale.customerPhone : ''}
        </div>
      </div>
      <div class="right">
        <div class="sec-label">Total Invoice Value</div>
        <div style="font-size:18px;font-weight:800;color:#16a34a;">${fc(sale.totalAmount)}</div>
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
        ${roundOffRow}
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
        All disputes are subject to jurisdiction of ${BUSINESS.state || 'local'} courts only.
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
  if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}

/* ─── Purchase Receipt function ─────────────────────────────── */
export function printPurchaseReceipt(purchase, firm) {
  const BUSINESS = {
    name:      firm?.name      ?? '',
    address:   firm?.address   ?? '',
    pincode:   firm?.pincode   ?? '',
    gstin:     firm?.gstin     ?? '',
    phone:     firm?.phone     ?? '',
    email:     firm?.email     ?? '',
    state:     firm?.state     ?? '',
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
    <th class="tc" style="width:4%">Sr.</th><th style="width:28%">Description</th><th class="tc" style="width:10%">HSN</th>
    <th class="tr" style="width:7%">Qty</th><th class="tr" style="width:12%">Rate</th><th class="tr" style="width:13%">Taxable</th>
    <th class="tc" style="width:7%">IGST%</th><th class="tr" style="width:10%">IGST Amt</th><th class="tr" style="width:9%">Total</th>
  </tr>` : `<tr>
    <th class="tc" style="width:4%">Sr.</th><th style="width:24%">Description</th><th class="tc" style="width:9%">HSN</th>
    <th class="tr" style="width:6%">Qty</th><th class="tr" style="width:10%">Rate</th><th class="tr" style="width:11%">Taxable</th>
    <th class="tc" style="width:6%">CGST%</th><th class="tr" style="width:9%">CGST</th>
    <th class="tc" style="width:6%">SGST%</th><th class="tr" style="width:9%">SGST</th><th class="tr" style="width:6%">Total</th>
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

  const rawTotal = (purchase.subtotal || 0) + (purchase.totalTax || 0);
  const roundOffAmt = (purchase.totalAmount || 0) - rawTotal;
  const roundOffRow = Math.abs(roundOffAmt) >= 0.01
    ? `<div class="tot-row roundoff"><span>Round Off</span><span>${roundOffAmt > 0 ? '+' : ''}${fc(roundOffAmt)}</span></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Receipt — ${purchase.invoiceNumber}</title>
  <style>${sharedCSS()}</style>
  ${paperScript()}
</head>
<body>
${printControlsBar('Print Receipt')}
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
    <div class="two-col right-align">
      <div class="left">
        <div class="sec-label">Supplier / Seller</div>
        <div class="biz-name">${purchase.supplierName}</div>
        <div class="biz-detail">
          ${purchase.supplierAddress ? purchase.supplierAddress + '<br>' : ''}
          <span class="gstin-tag">GSTIN:</span> ${purchase.supplierGST}
          ${purchase.supplierPhone ? '<br>Ph: ' + purchase.supplierPhone : ''}
        </div>
      </div>
      <div class="right">
        <div class="sec-label">Total Purchase Value</div>
        <div style="font-size:18px;font-weight:800;color:#16a34a;">${fc(purchase.totalAmount)}</div>
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
        ${roundOffRow}
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
        All disputes are subject to jurisdiction of ${BUSINESS.state || 'local'} courts only.
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
  if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
}
