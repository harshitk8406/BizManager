/**
 * ─── Cache Middleware ─────────────────────────────────────────────────────────
 *
 * Express middleware factory for route-level caching.
 *
 * Usage in a route file:
 *   const { cacheRoute } = require('../middleware/cacheMiddleware');
 *   router.get('/dashboard', cacheRoute(cache.keys.dashboard, cache.TTL.DASHBOARD), getDashboardStats);
 *
 * The middleware:
 *  1. Generates a cache key using the provided key builder (called with req.firmId + req.query)
 *  2. Returns cached JSON immediately on a hit
 *  3. On a miss: intercepts res.json(), stores the response, then forwards it
 */

const cache = require('../utils/cache');

/**
 * @param {Function} keyBuilder - (firmId, ...queryParams) => string
 * @param {number}   ttl        - TTL in seconds (use cache.TTL.* constants)
 * @param {Function} [paramsFn] - optional: (req) => [...extraArgs] passed to keyBuilder after firmId
 */
const cacheRoute = (keyBuilder, ttl, paramsFn = null) => async (req, res, next) => {
  // Build the cache key
  const extraArgs = paramsFn ? paramsFn(req) : [];
  const key = keyBuilder(req.firmId, ...extraArgs);

  try {
    const cached = await cache.get(key);
    if (cached !== null) {
      // Cache HIT — return immediately with a header indicating so
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', key);
      return res.json(cached);
    }

    // Cache MISS — intercept res.json to store the response
    res.set('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { await cache.set(key, body, ttl); } catch (e) {
          // Never let cache errors break the response
          console.warn('[Cache] Failed to write cache:', e.message);
        }
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    // Cache failure should never break the API — just skip caching
    console.warn('[Cache] Middleware error (bypassing cache):', err.message);
    next();
  }
};

module.exports = { cacheRoute };
