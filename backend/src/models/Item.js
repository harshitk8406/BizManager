const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  firm: { type: mongoose.Schema.Types.ObjectId, ref: 'Firm', required: true },
  itemCode: { type: String, required: true, trim: true },
  itemName: { type: String, required: true, trim: true },
  packingSize: { type: String, required: true, trim: true },
  hsnCode: { type: String, required: true, trim: true },
  openingQuantity: { type: Number, default: 0, min: 0 },
  closingQuantity: { type: Number, default: 0 },
  purchasePrice: { type: Number, default: 0, min: 0 },
  salesPrice: { type: Number, default: 0, min: 0 },
  gstPercentage: { type: Number, enum: [0, 5, 12, 18, 28], default: 18 },
}, { timestamps: true });

itemSchema.index({ firm: 1, itemName: 1 });
itemSchema.index({ firm: 1, itemCode: 1 }, { unique: true });

itemSchema.statics.generateItemCode = async function (firmId) {
  const last = await this.findOne({ firm: firmId }).sort({ createdAt: -1 }).lean();
  if (!last || !last.itemCode) return 'ITM-0001';
  const num = parseInt(last.itemCode.replace('ITM-', ''), 10);
  return `ITM-${String(num + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model('Item', itemSchema);
