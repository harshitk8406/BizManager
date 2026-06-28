require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const connectDB = require('./src/config/db');

const migrate = async () => {
  try {
    await connectDB();
    console.log('Connected to DB');

    // Drop index on email if it exists BEFORE renaming
    try {
      await User.collection.dropIndex('email_1');
      console.log('Dropped email index');
    } catch (err) {
      console.log('No email index found or could not drop:', err.message);
    }

    // Rename 'email' field to 'username'
    const result = await User.collection.updateMany({}, { $rename: { email: 'username' } });
    console.log(`Renamed email to username for ${result.modifiedCount} users`);

    // Ensure username index is built
    await User.syncIndexes();
    console.log('Synced indexes');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrate();
