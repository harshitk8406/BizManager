const Decimal = require('decimal.js');

const calculateGST = (taxableValue, gstRate, isInterState = false) => {
  const val = new Decimal(taxableValue);
  const rate = new Decimal(gstRate);

  let result = {
    taxableAmount: val.toNumber(),
    gstRate,
    isInterState,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    grandTotal: 0,
  };

  if (isInterState) {
    result.igst = val.times(rate).dividedBy(100).toDecimalPlaces(2).toNumber();
    result.totalTax = result.igst;
  } else {
    const halfRate = rate.dividedBy(2);
    result.cgst = val.times(halfRate).dividedBy(100).toDecimalPlaces(2).toNumber();
    result.sgst = result.cgst;
    result.totalTax = new Decimal(result.cgst).plus(result.sgst).toNumber();
  }

  result.grandTotal = val.plus(result.totalTax).toDecimalPlaces(2).toNumber();
  return result;
};

const calculateItemAmount = (quantity, rate, gstPercentage, isInterState = false) => {
  const taxableAmount = new Decimal(quantity).times(rate).toDecimalPlaces(2).toNumber();
  return calculateGST(taxableAmount, gstPercentage, isInterState);
};

module.exports = { calculateGST, calculateItemAmount };
