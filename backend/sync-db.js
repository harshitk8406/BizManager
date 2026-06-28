require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./src/models/Item');
const Supplier = require('./src/models/Supplier');
const Customer = require('./src/models/Customer');
const Purchase = require('./src/models/Purchase');
const Sale = require('./src/models/Sale');
const Firm = require('./src/models/Firm');
const User = require('./src/models/User');
const Payment = require('./src/models/Payment');

const sync = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/business_manager';
    console.log('Connecting to database...');
    // Mask password in logs
    const maskedUri = uri.replace(/:([^@]+)@/, ':******@');
    console.log(`URI: ${maskedUri}`);
    
    await mongoose.connect(uri);
    console.log('Connected successfully. Syncing indexes...');

    console.log('Syncing Item indexes...');
    await Item.syncIndexes();
    
    console.log('Syncing Supplier indexes...');
    await Supplier.syncIndexes();
    
    console.log('Syncing Customer indexes...');
    await Customer.syncIndexes();
    
    console.log('Syncing Purchase indexes...');
    await Purchase.syncIndexes();
    
    console.log('Syncing Sale indexes...');
    await Sale.syncIndexes();
    
    console.log('Syncing Firm indexes...');
    await Firm.syncIndexes();
    
    console.log('Syncing User indexes...');
    await User.syncIndexes();

    console.log('Syncing Payment indexes...');
    await Payment.syncIndexes();

    console.log('Database indexes synced successfully! Obsolete unique indexes have been dropped.');
    process.exit(0);
  } catch (err) {
    console.error('Error syncing indexes:', err);
    process.exit(1);
  }
};

sync();
