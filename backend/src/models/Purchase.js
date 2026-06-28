const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  itemCode: String,
  itemName: String,
  hsnCode: String,
  packingSize: String,
  quantity: { type: Number, required: true, min: 0.001 },
  rate: { type: Number, required: true, min: 0 },
  gstPercentage: { type: Number, required: true },
  isInterState: { type: Boolean, default: false },
  taxableAmount: Number,
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  totalTax: Number,
  amount: Number,
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  firm: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  purchaseCode: { type: String, required: true, trim: true },
  invoiceNumber: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName: String,
  supplierGST: String,
  supplierAddress: String,
  supplierPhone: String,
  isInterState: { type: Boolean, default: false },
  items: [purchaseItemSchema],
  subtotal: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  totalCgst: { type: Number, default: 0 },
  totalSgst: { type: Number, default: 0 },
  totalIgst: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
}, { timestamps: true });

purchaseSchema.index({ firm: 1, date: -1 });
purchaseSchema.index({ firm: 1, purchaseCode: 1 }, { unique: true });
purchaseSchema.index({ firm: 1, supplier: 1, invoiceNumber: 1 }, { unique: true });

purchaseSchema.statics.generatePurchaseCode = async function (firmId) {
  const last = await this.findOne({ firm: firmId }).sort({ createdAt: -1 }).lean();
  if (!last || !last.purchaseCode) return 'PUR-0001';
  const num = parseInt(last.purchaseCode.replace('PUR-', ''), 10);
  if (isNaN(num)) return 'PUR-0001';
  return `PUR-${String(num + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model('Purchase', purchaseSchema);
