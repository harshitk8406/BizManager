require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./src/models/User');
const Firm = require('./src/models/Firm');
const Item = require('./src/models/Item');
const Customer = require('./src/models/Customer');
const Supplier = require('./src/models/Supplier');
const Purchase = require('./src/models/Purchase');
const Sale = require('./src/models/Sale');

const connectDB = require('./src/config/db');

const migrate = async () => {
  try {
    await connectDB();
    console.log('Connected to DB');

    // 1. Drop existing indexes so we don't get duplicate key errors when we add the firm field
    console.log('Dropping existing indexes...');
    await Item.collection.dropIndexes();
    await Customer.collection.dropIndexes();
    await Supplier.collection.dropIndexes();
    await Purchase.collection.dropIndexes();
    await Sale.collection.dropIndexes();

    // 2. Re-build indexes with the new firm-scoped rules
    console.log('Re-building new firm-scoped indexes...');
    await Item.syncIndexes();
    await Customer.syncIndexes();
    await Supplier.syncIndexes();
    await Purchase.syncIndexes();
    await Sale.syncIndexes();

    // 3. Create a default User and Firm if they don't exist
    const username = 'admin';
    let user = await User.findOne({ username });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);
      user = await User.create({
        name: 'Admin',
        username,
        password: hashedPassword,
      });
      console.log('Created default user: admin / password123');
    }

    let firm = await Firm.findOne({ owner: user._id });
    if (!firm) {
      firm = await Firm.create({
        name: 'Dinesh Enterprises (Default)',
        address: 'Sector-8, Udaipur',
        pincode: '313002',
        gstin: '08ANEPK2132Q2ZR',
        phone: '+91 7014146811',
        email: 'dineshk@rediffmail.com',
        state: 'Rajasthan',
        stateCode: '08',
        owner: user._id
      });
      
      user.firms.push(firm._id);
      await user.save();
      console.log('Created default firm:', firm.name);
    }

    const firmId = firm._id;

    // 4. Attach all orphaned records to this default firm
    console.log('Migrating orphaned records to firm:', firmId);
    
    const itemsResult = await Item.updateMany({ firm: { $exists: false } }, { $set: { firm: firmId } });
    console.log(`Updated ${itemsResult.modifiedCount} Items`);

    const customersResult = await Customer.updateMany({ firm: { $exists: false } }, { $set: { firm: firmId } });
    console.log(`Updated ${customersResult.modifiedCount} Customers`);

    const suppliersResult = await Supplier.updateMany({ firm: { $exists: false } }, { $set: { firm: firmId } });
    console.log(`Updated ${suppliersResult.modifiedCount} Suppliers`);

    const purchasesResult = await Purchase.updateMany({ firm: { $exists: false } }, { $set: { firm: firmId } });
    console.log(`Updated ${purchasesResult.modifiedCount} Purchases`);

    const salesResult = await Sale.updateMany({ firm: { $exists: false } }, { $set: { firm: firmId } });
    console.log(`Updated ${salesResult.modifiedCount} Sales`);

    console.log('Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
