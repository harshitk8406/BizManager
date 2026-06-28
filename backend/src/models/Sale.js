const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
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

const saleSchema = new mongoose.Schema({
  firm: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  saleCode: { type: String, required: true, trim: true },
  invoiceNumber: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName: String,
  customerGST: String,
  customerAddress: String,
  customerPhone: String,
  isInterState: { type: Boolean, default: false },
  items: [saleItemSchema],
  subtotal: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  totalCgst: { type: Number, default: 0 },
  totalSgst: { type: Number, default: 0 },
  totalIgst: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
}, { timestamps: true });

saleSchema.index({ firm: 1, date: -1 });
saleSchema.index({ firm: 1, saleCode: 1 }, { unique: true });
saleSchema.index({ firm: 1, invoiceNumber: 1 }, { unique: true });

saleSchema.statics.generateSaleCode = async function (firmId) {
  const last = await this.findOne({ firm: firmId }).sort({ createdAt: -1 }).lean();
  if (!last || !last.saleCode) return 'SAL-0001';
  const num = parseInt(last.saleCode.replace('SAL-', ''), 10);
  if (isNaN(num)) return 'SAL-0001';
  return `SAL-${String(num + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model('Sale', saleSchema);
