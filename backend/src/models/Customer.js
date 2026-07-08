const db = require('../config/db');
const Customer = db.customers;

Customer.generateCustomerCode = async function (firmId) {
  const items = await this.find({ firm: firmId }).sort({ createdAt: -1 }).limit(1);
  const last = items[0];
  if (!last || !last.customerCode) return 'CUS-0001';
  const num = parseInt(last.customerCode.replace('CUS-', ''), 10);
  if (isNaN(num)) return 'CUS-0001';
  return `CUS-${String(num + 1).padStart(4, '0')}`;
};

module.exports = Customer;
