const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');

// Determine local database directory
const dbDir = process.env.APPDATA 
  ? path.join(process.env.APPDATA, 'bizmanager-monorepo', 'db_data')
  : path.join(process.env.HOME || '.', '.bizmanager', 'db_data');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize NeDB Datastores
const datastores = {
  users: new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true }),
  firms: new Datastore({ filename: path.join(dbDir, 'firms.db'), autoload: true }),
  items: new Datastore({ filename: path.join(dbDir, 'items.db'), autoload: true }),
  customers: new Datastore({ filename: path.join(dbDir, 'customers.db'), autoload: true }),
  suppliers: new Datastore({ filename: path.join(dbDir, 'suppliers.db'), autoload: true }),
  purchases: new Datastore({ filename: path.join(dbDir, 'purchases.db'), autoload: true }),
  sales: new Datastore({ filename: path.join(dbDir, 'sales.db'), autoload: true }),
  payments: new Datastore({ filename: path.join(dbDir, 'payments.db'), autoload: true }),
  challans: new Datastore({ filename: path.join(dbDir, 'challans.db'), autoload: true })
};

// Ensure indexes
datastores.users.ensureIndex({ fieldName: 'username', unique: true });

// Helper to recursively convert MongoDB $regex queries to native RegExp objects for NeDB
function convertRegexOperators(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Preserve Date objects — do NOT iterate their keys (Object.keys(date) === [])
  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map(convertRegexOperators);
  }

  const newObj = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === 'object' && value.$regex) {
      const options = value.$options || '';
      const pattern = value.$regex instanceof RegExp ? value.$regex.source : value.$regex;
      newObj[key] = new RegExp(pattern, options);
    } else {
      newObj[key] = convertRegexOperators(value);
    }
  }
  return newObj;
}

// NeDB Query Wrapper (simulates Mongoose Query)
class NeDBQuery {
  constructor(datastore, query, isFindOne = false) {
    this.datastore = datastore;
    this.query = convertRegexOperators(query);
    this.isFindOne = isFindOne;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._populate = [];
    this._select = null;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  limit(limitVal) {
    this._limit = limitVal;
    return this;
  }

  skip(skipVal) {
    this._skip = skipVal;
    return this;
  }

  select(selectVal) {
    this._select = selectVal;
    return this;
  }

  populate(path, select) {
    this._populate.push({ path, select });
    return this;
  }

  lean() {
    return this; // NeDB documents are already plain JSON objects
  }

  async then(resolve, reject) {
    try {
      let cursor = this.isFindOne 
        ? this.datastore.findOne(this.query)
        : this.datastore.find(this.query);

      if (this._sort && !this.isFindOne) cursor = cursor.sort(this._sort);
      if (this._skip && !this.isFindOne) cursor = cursor.skip(this._skip);
      if (this._limit && !this.isFindOne) cursor = cursor.limit(this._limit);

      let docs = await new Promise((res, rej) => {
        cursor.exec((err, result) => {
          if (err) rej(err);
          else res(result);
        });
      });

      if (!docs) {
        resolve(null);
        return;
      }

      // Ensure docs is an array for easy processing
      const isArray = Array.isArray(docs);
      let docsArray = isArray ? docs : [docs];

      // Add .id virtual alias to all documents
      docsArray = docsArray.map(doc => {
        if (doc && typeof doc === 'object' && doc._id) {
          const newDoc = { ...doc };
          Object.defineProperty(newDoc, 'id', {
            get: function() { return this._id; },
            enumerable: true,
            configurable: true
          });
          return newDoc;
        }
        return doc;
      });

      // Handle select (simulated)
      if (this._select && typeof this._select === 'string') {
        const fields = this._select.split(' ');
        const exclude = fields.every(f => f.startsWith('-'));
        const cleanFields = fields.map(f => f.replace('-', ''));
        
        docsArray = docsArray.map(doc => {
          const newDoc = { ...doc };
          if (exclude) {
            cleanFields.forEach(f => delete newDoc[f]);
          } else {
            Object.keys(newDoc).forEach(k => {
              if (!cleanFields.includes(k) && k !== '_id' && k !== 'id') delete newDoc[k];
            });
          }
          return newDoc;
        });
      }

      // Handle populate
      if (this._populate.length > 0) {
        for (const pop of this._populate) {
          let targetCollectionName = null;
          if (pop.path === 'supplier') targetCollectionName = 'suppliers';
          else if (pop.path === 'customer') targetCollectionName = 'customers';
          else if (pop.path === 'firms' || pop.path === 'firm') targetCollectionName = 'firms';

          if (targetCollectionName && datastores[targetCollectionName]) {
            const targetCol = datastores[targetCollectionName];
            for (const doc of docsArray) {
              const refId = doc[pop.path];
              if (refId) {
                if (Array.isArray(refId)) {
                  // Array of IDs (e.g. user.firms)
                  const populatedDocs = await new Promise((res, rej) => {
                    targetCol.find({ _id: { $in: refId } }).exec((err, results) => {
                      if (err) rej(err);
                      else res(results);
                    });
                  });
                  
                  // Wrap populated docs with .id virtual as well
                  doc[pop.path] = populatedDocs.map(d => {
                    const newD = { ...d };
                    Object.defineProperty(newD, 'id', {
                      get: function() { return this._id; },
                      enumerable: true,
                      configurable: true
                    });
                    return newD;
                  });
                } else {
                  // Single ID reference
                  const populatedDoc = await new Promise((res, rej) => {
                    targetCol.findOne({ _id: refId }).exec((err, result) => {
                      if (err) rej(err);
                      else res(result);
                    });
                  });
                  if (populatedDoc) {
                    const newD = { ...populatedDoc };
                    Object.defineProperty(newD, 'id', {
                      get: function() { return this._id; },
                      enumerable: true,
                      configurable: true
                    });
                    doc[pop.path] = newD;
                  } else {
                    doc[pop.path] = null;
                  }
                }
              }
            }
          }
        }
      }

      resolve(isArray ? docsArray : docsArray[0]);
    } catch (err) {
      reject(err);
    }
  }
}

// NeDB Model Wrapper (simulates Mongoose Model)
class NeDBModel {
  constructor(datastore) {
    this.db = datastore;
  }

  find(query = {}) {
    return new NeDBQuery(this.db, query, false);
  }

  findOne(query = {}) {
    return new NeDBQuery(this.db, query, true);
  }

  findById(id) {
    return this.findOne({ _id: id });
  }

  async create(doc) {
    return new Promise((resolve, reject) => {
      // Add createdAt and updatedAt timestamps if not present
      const now = new Date();
      const docWithTimestamps = {
        createdAt: now,
        updatedAt: now,
        ...doc
      };
      
      // Auto-cast date string to Date object for NeDB compatibility
      if (docWithTimestamps.date && typeof docWithTimestamps.date === 'string') {
        docWithTimestamps.date = new Date(docWithTimestamps.date);
      }
      
      this.db.insert(docWithTimestamps, (err, newDoc) => {
        if (err) reject(err);
        else resolve(newDoc);
      });
    });
  }

  async findOneAndUpdate(query, update, options = {}) {
    // Determine if update is a $set query or just fields
    const hasOperators = Object.keys(update).some(key => key.startsWith('$'));
    const updateQuery = hasOperators ? update : { $set: update };
    
    // Set updatedAt timestamp
    if (updateQuery.$set) {
      updateQuery.$set.updatedAt = new Date();
      // Auto-cast date string to Date object for NeDB compatibility
      if (updateQuery.$set.date && typeof updateQuery.$set.date === 'string') {
        updateQuery.$set.date = new Date(updateQuery.$set.date);
      }
    } else {
      updateQuery.$set = { updatedAt: new Date() };
    }

    // Find current doc
    const doc = await this.findOne(query);
    if (!doc) return null;

    return new Promise((resolve, reject) => {
      this.db.update(query, updateQuery, { returnUpdatedDocs: true, multi: false }, (err, numAffected, affectedDocuments) => {
        if (err) reject(err);
        else resolve(options.new === false ? doc : affectedDocuments);
      });
    });
  }

  async findOneAndDelete(query) {
    const doc = await this.findOne(query);
    if (!doc) return null;

    return new Promise((resolve, reject) => {
      this.db.remove(query, {}, (err, numRemoved) => {
        if (err) reject(err);
        else resolve(doc);
      });
    });
  }

  async countDocuments(query = {}) {
    return new Promise((resolve, reject) => {
      this.db.count(query, (err, count) => {
        if (err) reject(err);
        else resolve(count);
      });
    });
  }
}

// Simulated connectDB function for server.js
const connectDB = async () => {
  console.log('NeDB Datastores Initialized (Local JSON storage)');

  // Run automatic date migration for existing documents
  const collectionsToMigrate = ['purchases', 'sales', 'payments'];
  for (const colName of collectionsToMigrate) {
    const store = datastores[colName];
    if (store) {
      await new Promise((resolve) => {
        store.find({ date: { $exists: true } }, (err, docs) => {
          if (err || !docs) return resolve();
          
          let migratedCount = 0;
          const promises = docs.map(doc => {
            if (doc.date && typeof doc.date === 'string') {
              return new Promise((res) => {
                store.update({ _id: doc._id }, { $set: { date: new Date(doc.date) } }, {}, () => {
                  migratedCount++;
                  res();
                });
              });
            }
            return Promise.resolve();
          });
          
          Promise.all(promises).then(() => {
            if (migratedCount > 0) {
              console.log(`Migrated ${migratedCount} string dates to Date objects in ${colName}`);
            }
            resolve();
          });
        });
      });
    }
  }

  return true;
};

// Attach collections as properties of the connectDB function
connectDB.users = new NeDBModel(datastores.users);
connectDB.firms = new NeDBModel(datastores.firms);
connectDB.items = new NeDBModel(datastores.items);
connectDB.customers = new NeDBModel(datastores.customers);
connectDB.suppliers = new NeDBModel(datastores.suppliers);
connectDB.purchases = new NeDBModel(datastores.purchases);
connectDB.sales = new NeDBModel(datastores.sales);
connectDB.payments = new NeDBModel(datastores.payments);
connectDB.challans = new NeDBModel(datastores.challans);

module.exports = connectDB;
