const db = require('../config/db');
const Supplier = db.suppliers;

Supplier.generateSupplierCode = async function (firmId) {
  const items = await this.find({ firm: firmId }).sort({ createdAt: -1 }).limit(1);
  const last = items[0];
  if (!last || !last.supplierCode) return 'SUP-0001';
  const num = parseInt(last.supplierCode.replace('SUP-', ''), 10);
  if (isNaN(num)) return 'SUP-0001';
  return `SUP-${String(num + 1).padStart(4, '0')}`;
};

module.exports = Supplier;
