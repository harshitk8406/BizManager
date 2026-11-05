const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
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

// ─── API Routes ───────────────────────────────────────────────
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
app.use('/api/cache',   protect, requireFirm, require('./src/routes/cache'));


app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── Serve React Frontend (for Render/web deployment) ────────
// In Electron, the frontend is loaded via loadFile() and this block is skipped.
// On Render (or any web server), the built frontend is served as static files.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendDist)) {
  // Serve static assets (JS, CSS, images)
  app.use(express.static(frontendDist));

  // SPA catch-all: for any non-API route, return index.html
  // This allows React Router to handle client-side navigation
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // Fallback if frontend is not built (development or Electron-only context)
  app.get('/', (req, res) => res.json({
    name: 'BizManager API',
    version: '1.0.0',
    status: 'running',
    note: 'Frontend not built. Run: npm run build-frontend'
  }));
}

app.use(errorHandler);

module.exports = app;

