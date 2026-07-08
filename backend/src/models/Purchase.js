const db = require('../config/db');
const Purchase = db.purchases;

Purchase.generatePurchaseCode = async function (firmId) {
  const items = await this.find({ firm: firmId }).sort({ createdAt: -1 }).limit(1);
  const last = items[0];
  if (!last || !last.purchaseCode) return 'PUR-0001';
  const num = parseInt(last.purchaseCode.replace('PUR-', ''), 10);
  if (isNaN(num)) return 'PUR-0001';
  return `PUR-${String(num + 1).padStart(4, '0')}`;
};

module.exports = Purchase;
