/* ─── Amount in Words (Indian system) ──────────────────────── */
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
  'Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function below100(n){return n<20?ONES[n]:TENS[Math.floor(n/10)]+(n%10?' '+ONES[n%10]:'');}
function below1000(n){return n<100?below100(n):ONES[Math.floor(n/100)]+' Hundred'+(n%100?' '+below100(n%100):'');}
function convertIndian(n){
  if(n===0)return'';
  if(n<1000)return below1000(n);
  if(n<100000)return below1000(Math.floor(n/1000))+' Thousand'+(n%1000?' '+below1000(n%1000):'');
  if(n<10000000)return below1000(Math.floor(n/100000))+' Lakh'+(n%100000?' '+convertIndian(n%100000):'');
  return below1000(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+convertIndian(n%10000000):'');
}
function amountInWords(amount){
  const rupees=Math.floor(amount);
  const paise=Math.round((amount-rupees)*100);
  let result=(convertIndian(rupees)||'Zero')+' Rupees';
  if(paise>0)result+=' and '+below100(paise)+' Paise';
  return result+' Only';
}

function fmt(n){ return '₹'+(Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(d){ if(!d)return''; const dt=new Date(d); return dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }

/* ── Main print function ─────────────────────────────────────── */
export function printDeliveryChallan(challan, firm) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const firmName    = firm?.name             || 'Your Business Name';
  const firmAddr    = firm?.address          || '';
  const firmGST     = firm?.gstin            || '';
  const firmPhone   = firm?.phone            || '';
  const firmEmail   = firm?.email            || '';
  const firmState   = firm?.state            || '';

  const items = challan.items || [];
  const total = challan.totalAmount || 0;

  const itemRows = items.map((it, idx) => `
    <tr>
      <td class="tc">${idx + 1}</td>
      <td>${it.itemName || ''}<br/><span class="sub">${it.itemCode||''}</span></td>
      <td class="tc">${it.hsnCode || '—'}</td>
      <td class="tc">${it.packingSize || '—'}</td>
      <td class="tr">${it.quantity || 0}</td>
      <td class="tr">${fmt(it.rate)}</td>
      <td class="tr"><strong>${fmt(it.amount)}</strong></td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Delivery Challan — ${challan.challanNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; }
    body { font-size: 12px; color: #111; background:#fff; }

    /* ─── Paper-size toolbar ─────────────────────────────── */
    #psbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1e293b; color: #fff; padding: 8px 16px;
      display: flex; align-items: center; gap: 10px; font-size: 13px;
    }
    #psbar span { font-weight: 700; margin-right: 6px; }
    #psbar select, #psbar button {
      border: none; border-radius: 6px; padding: 5px 12px;
      font-size: 13px; cursor: pointer;
    }
    #psbar select { background: #334155; color: #fff; }
    #psbar button { background: #16a34a; color: #fff; font-weight: 700; }
    #spacer { height: 44px; }
    @media print { #psbar, #spacer { display: none !important; } }

    /* ─── Document ───────────────────────────────────────── */
    .page { padding: 4mm; }

    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 10px; }
    .firm-block h1 { font-size: 20px; font-weight: 900; color: #1e293b; }
    .firm-block p  { font-size: 11px; color: #475569; margin-top: 2px; line-height: 1.5; }

    .doc-title-block { text-align: right; }
    .doc-title { font-size: 22px; font-weight: 900; color: #1e293b; letter-spacing: 1px; text-transform: uppercase; }
    .doc-note  { font-size: 10px; color: #dc2626; font-weight: 700; margin-top: 3px; border: 1px solid #fca5a5; padding: 2px 8px; border-radius: 4px; display: inline-block; }
    .chn-num   { font-size: 13px; font-weight: 700; color: #16a34a; margin-top: 6px; }

    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .meta-box  { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; background: #f8fafc; }
    .meta-box h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 6px; }
    .meta-row  { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
    .meta-row .label { color: #6b7280; }
    .meta-row .val   { font-weight: 600; text-align: right; }

    .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .bill-box  { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .bill-box h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 4px; }
    .bill-box p  { font-size: 12px; line-height: 1.7; }
    .bill-name   { font-size: 13px; font-weight: 800; color: #1e293b; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
    th { background: #1e293b; color: #fff; padding: 7px 8px; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .tc { text-align: center; }
    .tr { text-align: right; }
    .sub { font-size: 10px; color: #9ca3af; }

    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .totals-box  { width: 280px; }
    .totals-row  { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .grand-row   { padding: 7px 0; background: #1e293b; color: #fff; border-radius: 6px; padding: 6px 12px; margin-top: 4px; font-size: 14px; font-weight: 800; display:flex; justify-content:space-between; }

    .words-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; }
    .words-box span { font-style: italic; font-weight: 600; color: #15803d; }

    .remarks-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; background: #fffbeb; }
    .remarks-box h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #92400e; margin-bottom: 4px; }

    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
    .sig-box  { border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; font-size: 10px; color: #64748b; }

    .footer-note { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>

<!-- Paper-size toolbar -->
<div id="psbar">
  <span>📄 Paper:</span>
  <select id="ps" onchange="setSize()">
    <option value="A4 portrait">A4 Portrait</option>
    <option value="A4 landscape">A4 Landscape</option>
    <option value="A5 portrait">A5 Portrait</option>
    <option value="Letter portrait">Letter Portrait</option>
    <option value="Legal portrait">Legal Portrait</option>
  </select>
  <button onclick="window.print()">🖨 Print</button>
</div>
<div id="spacer"></div>
<script>
  function setSize(){
    const v=document.getElementById('ps').value;
    const parts=v.split(' ');
    let css='@page{size:'+parts[0]+' '+parts[1]+';margin:14mm 12mm;}';
    let el=document.getElementById('psstyle');
    if(!el){el=document.createElement('style');el.id='psstyle';document.head.appendChild(el);}
    el.textContent=css;
  }
</script>

<div class="page">

  <!-- Header -->
  <div class="doc-header">
    <div class="firm-block">
      <h1>${firmName}</h1>
      <p>
        ${firmAddr ? firmAddr + '<br/>' : ''}
        ${firmGST ? 'GSTIN: <strong>' + firmGST + '</strong>' : ''}
        ${firmPhone ? ' · ' + firmPhone : ''}
        ${firmEmail ? ' · ' + firmEmail : ''}
        ${firmState ? '<br/>State: ' + firmState : ''}
      </p>
    </div>
    <div class="doc-title-block">
      <div class="doc-title">Delivery Challan</div>
      <div class="doc-note">NOT A TAX INVOICE</div>
      <div class="chn-num">${challan.challanNumber || ''}</div>
    </div>
  </div>

  <!-- Meta -->
  <div class="meta-grid">
    <div class="meta-box">
      <h4>Challan Details</h4>
      <div class="meta-row"><span class="label">Challan No.</span><span class="val">${challan.challanNumber || '—'}</span></div>
      <div class="meta-row"><span class="label">Date</span><span class="val">${fmtDate(challan.date)}</span></div>
      ${challan.dueDate ? `<div class="meta-row"><span class="label">Expected Date</span><span class="val">${fmtDate(challan.dueDate)}</span></div>` : ''}
      <div class="meta-row"><span class="label">Status</span><span class="val" style="text-transform:capitalize">${challan.status || '—'}</span></div>
    </div>
    <div class="meta-box">
      <h4>Transport Details</h4>
      <div class="meta-row"><span class="label">Vehicle No.</span><span class="val">${challan.vehicleNumber || '—'}</span></div>
      <div class="meta-row"><span class="label">Carrier / Transporter</span><span class="val">${challan.transporterName || '—'}</span></div>
      <div class="meta-row"><span class="label">LR / GR No.</span><span class="val">${challan.lrNumber || '—'}</span></div>
      <div class="meta-row"><span class="label">Supply Type</span><span class="val">${challan.supplyType || 'For Delivery'}</span></div>
    </div>
  </div>

  <!-- Customer -->
  <div class="bill-grid">
    <div class="bill-box">
      <h4>Bill To (Consignee)</h4>
      <p>
        <span class="bill-name">${challan.customerName || ''}</span><br/>
        ${challan.customerAddress || ''}<br/>
        ${challan.customerGST ? 'GSTIN: ' + challan.customerGST : ''}
        ${challan.customerPhone ? '<br/>Phone: ' + challan.customerPhone : ''}
      </p>
    </div>
    <div class="bill-box" style="background:#f0fdf4;">
      <h4>Consignor (Ship From)</h4>
      <p>
        <span class="bill-name">${firmName}</span><br/>
        ${firmAddr ? firmAddr + '<br/>' : ''}
        ${firmGST ? 'GSTIN: ' + firmGST : ''}
      </p>
    </div>
  </div>

  <!-- Items table -->
  <table>
    <thead>
      <tr>
        <th class="tc" style="width:34px">#</th>
        <th>Item Description</th>
        <th class="tc" style="width:70px">HSN</th>
        <th class="tc" style="width:60px">Pack</th>
        <th class="tr" style="width:55px">Qty</th>
        <th class="tr" style="width:80px">Rate</th>
        <th class="tr" style="width:95px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-wrap">
    <div class="totals-box">
      <div class="totals-row"><span>Sub Total (${items.length} item${items.length !== 1 ? 's' : ''})</span><span>${fmt(total)}</span></div>
      <div class="grand-row"><span>TOTAL</span><span>${fmt(total)}</span></div>
    </div>
  </div>

  <!-- Amount in words -->
  <div class="words-box">
    Amount in Words: <span>${amountInWords(total)}</span>
  </div>

  ${challan.remarks ? `<div class="remarks-box"><h4>Remarks / Instructions</h4><p>${challan.remarks}</p></div>` : ''}

  <!-- Signatures -->
  <div class="sig-grid">
    <div class="sig-box">Receiver's Signature &amp; Stamp</div>
    <div class="sig-box">For <strong>${firmName}</strong><br/>Authorised Signatory</div>
  </div>

  <!-- Footer -->
  <div class="footer-note">
    This is a Delivery Challan only and does NOT constitute a Tax Invoice. GST is not applicable on this document.<br/>
    ${challan.convertedInvoiceNumber ? `Converted to Invoice: <strong>${challan.convertedInvoiceNumber}</strong>` : 'Goods received in good condition subject to our terms &amp; conditions.'}
  </div>

</div>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}
