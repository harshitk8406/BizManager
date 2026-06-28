const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./src/middleware/errorHandler');
const { protect } = require('./src/middleware/authMiddleware');
const { requireFirm } = require('./src/middleware/firmMiddleware');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({ origin: allowedOrigins }));
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

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use(errorHandler);

module.exports = app;
