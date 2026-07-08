const db = require('../config/db');
const Challan = db.challans;

Challan.generateChallanCode = async function (firmId) {
  const items = await this.find({ firm: firmId }).sort({ createdAt: -1 }).limit(1);
  const last = items[0];
  if (!last || !last.challanCode) return 'CHN-0001';
  const num = parseInt(last.challanCode.replace('CHN-', ''), 10);
  if (isNaN(num)) return 'CHN-0001';
  return `CHN-${String(num + 1).padStart(4, '0')}`;
};

module.exports = Challan;
