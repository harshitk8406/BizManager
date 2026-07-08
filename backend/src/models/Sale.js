const db = require('../config/db');
const Sale = db.sales;

Sale.generateSaleCode = async function (firmId) {
  const items = await this.find({ firm: firmId }).sort({ createdAt: -1 }).limit(1);
  const last = items[0];
  if (!last || !last.saleCode) return 'SAL-0001';
  const num = parseInt(last.saleCode.replace('SAL-', ''), 10);
  if (isNaN(num)) return 'SAL-0001';
  return `SAL-${String(num + 1).padStart(4, '0')}`;
};

module.exports = Sale;
