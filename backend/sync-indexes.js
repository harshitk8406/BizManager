const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Failed to set DNS servers, falling back to system defaults:', e.message);
}

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // 1. Find all users
    const users = await User.find({});
    console.log(`Total users found: ${users.length}`);

    // 2. Identify duplicates (case-insensitive)
    const usernameMap = {};
    const duplicates = [];

    for (const u of users) {
      const lower = u.username.toLowerCase().trim();
      if (usernameMap[lower]) {
        duplicates.push(u);
      } else {
        usernameMap[lower] = u;
      }
    }

    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate user record(s):`);
      for (const dup of duplicates) {
        console.log(`- ID: ${dup._id}, Name: ${dup.name}, Username: "${dup.username}"`);
        // Let's rename the duplicate to make it unique, e.g. username_dup_timestamp
        const uniqueSuffix = `_dup_${Date.now().toString().slice(-4)}`;
        const newUsername = dup.username + uniqueSuffix;
        console.log(`  Renaming to: "${newUsername}"`);
        dup.username = newUsername;
        await dup.save();
      }
      console.log('Duplicates renamed successfully.');
    } else {
      console.log('No duplicate usernames found.');
    }

    // 3. Re-build/Sync Indexes
    console.log('Dropping existing indexes on users collection...');
    try {
      await User.collection.dropIndex('username_1');
      console.log('Index username_1 dropped.');
    } catch (e) {
      console.log('No existing username_1 index to drop or error dropping: ' + e.message);
    }

    console.log('Creating unique index on username...');
    await User.collection.createIndex({ username: 1 }, { unique: true });
    console.log('Unique index created successfully!');

    // Verify indexes
    const indexes = await User.collection.indexes();
    console.log('Current indexes on users collection:', JSON.stringify(indexes, null, 2));

  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
