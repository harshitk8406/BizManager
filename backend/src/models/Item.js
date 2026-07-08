const db = require('../config/db');
const Item = db.items;

Item.generateItemCode = async function (firmId) {
  const items = await this.find({ firm: firmId }).sort({ createdAt: -1 }).limit(1);
  const last = items[0];
  if (!last || !last.itemCode) return 'ITM-0001';
  const num = parseInt(last.itemCode.replace('ITM-', ''), 10);
  return `ITM-${String(num + 1).padStart(4, '0')}`;
};

module.exports = Item;
