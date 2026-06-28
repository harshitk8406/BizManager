// Calculate GST breakdown (mirrors backend logic)
export const calculateGST = (taxableAmount, gstRate, isInterState = false) => {
  const val = parseFloat(taxableAmount) || 0;
  const rate = parseFloat(gstRate) || 0;

  let cgst = 0, sgst = 0, igst = 0;

  if (isInterState) {
    igst = parseFloat((val * rate / 100).toFixed(2));
  } else {
    cgst = parseFloat((val * (rate / 2) / 100).toFixed(2));
    sgst = cgst;
  }

  const totalTax = parseFloat((cgst + sgst + igst).toFixed(2));
  const grandTotal = parseFloat((val + totalTax).toFixed(2));

  return { taxableAmount: val, cgst, sgst, igst, totalTax, grandTotal };
};

// Calculate line item totals
export const calculateLineItem = (qty, rate, gstPct, isInterState = false) => {
  const taxableAmount = parseFloat((parseFloat(qty || 0) * parseFloat(rate || 0)).toFixed(2));
  return calculateGST(taxableAmount, gstPct, isInterState);
};
