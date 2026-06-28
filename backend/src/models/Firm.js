const mongoose = require('mongoose');

const firmSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  pincode: { type: String, default: '', trim: true },
  gstin: { type: String, default: '', uppercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  state: { type: String, default: '', trim: true },
  stateCode: { type: String, default: '', trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Firm', firmSchema);
