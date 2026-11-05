/**
 * ─── Cache Admin Routes ───────────────────────────────────────────────────────
 *
 * Protected admin endpoints to inspect and manage the in-memory cache.
 *
 * GET  /api/cache/stats          → returns cache size and TTL constants
 * POST /api/cache/invalidate     → clears all cache for the current firm
 * POST /api/cache/flush          → flushes the ENTIRE cache (all firms)
 */

const express = require('express');
const router  = express.Router();
const cache   = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/cache/stats
 * Returns current cache status — useful for debugging and dashboards.
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const size = await cache.size();
  res.json({
    success: true,
    data: {
      backend:     'memory',
      totalKeys:   size,
      ttl: {
        dashboard: `${cache.TTL.DASHBOARD}s (${cache.TTL.DASHBOARD / 60} min)`,
        report:    `${cache.TTL.REPORT}s (${cache.TTL.REPORT / 60} min)`,
        list:      `${cache.TTL.LIST}s (${cache.TTL.LIST / 60} min)`,
        short:     `${cache.TTL.SHORT}s (${cache.TTL.SHORT / 60} min)`,
      },
      firmId: req.firmId,
    }
  });
}));

/**
 * POST /api/cache/invalidate
 * Clears all cached data for the currently authenticated firm.
 */
router.post('/invalidate', asyncHandler(async (req, res) => {
  await cache.invalidateFirm(req.firmId);
  res.json({
    success: true,
    message: `Cache invalidated for firm ${req.firmId}`,
  });
}));

/**
 * POST /api/cache/flush
 * Flushes the entire cache (all firms). Use with caution.
 */
router.post('/flush', asyncHandler(async (req, res) => {
  await cache.flush();
  res.json({
    success: true,
    message: 'Entire cache flushed successfully',
  });
}));

module.exports = router;
