require('dotenv').config();
const mongoose = require('mongoose');
const Firm = require('./src/models/Firm');

const updateGSTIN = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/business_manager';
  console.log(`Attempting connection to database: ${uri.split('@').pop()}`); // secure logging
  
  try {
    // Attempt connection
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000 // fail fast if connection cannot be made
    });
    console.log(`Connected successfully to ${conn.connection.host}`);

    // Update all firms with the new GSTIN, state, and stateCode
    const result = await Firm.updateMany(
      {},
      {
        $set: {
          gstin: '08ANEPK2132Q2ZR',
          state: 'Rajasthan',
          stateCode: '08'
        }
      }
    );

    console.log(`Successfully updated GSTIN to 08ANEPK2132Q2ZR for ${result.modifiedCount} firms.`);
    process.exit(0);
  } catch (error) {
    console.error('Database connection or update failed. Trying local database fallback...', error.message);
    
    // Fallback to local MongoDB if Atlas connection failed
    if (uri !== 'mongodb://localhost:27017/business_manager') {
      try {
        const localUri = 'mongodb://localhost:27017/business_manager';
        console.log(`Attempting connection to local fallback: ${localUri}`);
        const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        console.log(`Connected successfully to local fallback: ${conn.connection.host}`);
        
        const result = await Firm.updateMany(
          {},
          {
            $set: {
              gstin: '08ANEPK2132Q2ZR',
              state: 'Rajasthan',
              stateCode: '08'
            }
          }
        );
        console.log(`Successfully updated GSTIN to 08ANEPK2132Q2ZR for ${result.modifiedCount} firms (Local DB).`);
        process.exit(0);
      } catch (localError) {
        console.error('Local database update also failed:', localError.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
};

updateGSTIN();
