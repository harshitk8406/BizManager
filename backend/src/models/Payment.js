const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  firm: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Firm', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['received', 'sent'], 
    required: true 
  },
  partyType: { 
    type: String, 
    enum: ['customer', 'supplier'], 
    required: true 
  },
  customer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer' 
  },
  supplier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Supplier' 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0.01 
  },
  paymentMode: { 
    type: String, 
    enum: ['cash', 'bank'], 
    required: true 
  },
  bankName: { 
    type: String, 
    default: '', 
    trim: true 
  },
  referenceNumber: { 
    type: String, 
    default: '', 
    trim: true 
  },
  remarks: { 
    type: String, 
    default: '', 
    trim: true 
  },
  date: { 
    type: Date, 
    required: true, 
    default: Date.now 
  }
}, { timestamps: true });

// Scoped index rules for performance
paymentSchema.index({ firm: 1, date: -1 });
paymentSchema.index({ firm: 1, customer: 1 });
paymentSchema.index({ firm: 1, supplier: 1 });
paymentSchema.index({ firm: 1, type: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
