const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./src/middleware/errorHandler');
const { protect } = require('./src/middleware/authMiddleware');
const { requireFirm } = require('./src/middleware/firmMiddleware');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000'];

// Allow null origin for file:// protocol (used by Electron loadFile)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in Electron context
    }
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/firms', require('./src/routes/firms'));

app.use('/api/items', protect, requireFirm, require('./src/routes/items'));
app.use('/api/suppliers', protect, requireFirm, require('./src/routes/suppliers'));
app.use('/api/customers', protect, requireFirm, require('./src/routes/customers'));
app.use('/api/purchases', protect, requireFirm, require('./src/routes/purchases'));
app.use('/api/sales', protect, requireFirm, require('./src/routes/sales'));
app.use('/api/reports', protect, requireFirm, require('./src/routes/reports'));
app.use('/api/payments', protect, requireFirm, require('./src/routes/payments'));
app.use('/api/challans', protect, requireFirm, require('./src/routes/challan'));
app.use('/api/ai',       protect, requireFirm, require('./src/routes/ai'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Note: Static file serving removed — Electron loads frontend/dist/index.html
// directly via loadFile(). Express only handles /api/* routes.

app.use(errorHandler);

module.exports = app;
