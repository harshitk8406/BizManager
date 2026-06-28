const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  firm: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  customerCode:    { type: String, required: true, trim: true },
  gstNumber:       { type: String, required: true, uppercase: true, trim: true },
  customerName:    { type: String, required: true, trim: true },
  customerAddress: { type: String, default: '', trim: true },
  customerPhone:   { type: String, default: '', trim: true },
}, { timestamps: true });

customerSchema.index({ firm: 1, customerName: 1 });
customerSchema.index({ firm: 1, customerCode: 1 }, { unique: true });
customerSchema.index({ firm: 1, gstNumber: 1 });

customerSchema.statics.generateCustomerCode = async function (firmId) {
  const last = await this.findOne({ firm: firmId }).sort({ createdAt: -1 }).lean();
  if (!last || !last.customerCode) return 'CUS-0001';
  const num = parseInt(last.customerCode.replace('CUS-', ''), 10);
  if (isNaN(num)) return 'CUS-0001';
  return `CUS-${String(num + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model('Customer', customerSchema);
