const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  firm: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  supplierCode: { type: String, required: true, trim: true },
  gstNumber: { type: String, required: true, uppercase: true, trim: true },
  supplierName: { type: String, required: true, trim: true },
  supplierAddress: { type: String, default: '', trim: true },
  supplierPhone: { type: String, default: '', trim: true },
}, { timestamps: true });

supplierSchema.index({ firm: 1, supplierName: 1 });
supplierSchema.index({ firm: 1, supplierCode: 1 }, { unique: true });
supplierSchema.index({ firm: 1, gstNumber: 1 });

supplierSchema.statics.generateSupplierCode = async function (firmId) {
  const last = await this.findOne({ firm: firmId }).sort({ createdAt: -1 }).lean();
  if (!last || !last.supplierCode) return 'SUP-0001';
  const num = parseInt(last.supplierCode.replace('SUP-', ''), 10);
  if (isNaN(num)) return 'SUP-0001';
  return `SUP-${String(num + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model('Supplier', supplierSchema);
