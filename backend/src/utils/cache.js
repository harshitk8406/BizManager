/**
 * ─── BizManager Cache Layer ───────────────────────────────────────────────────
 *
 * Simple in-memory TTL cache (no Redis dependency).
 * Auto-evicts expired entries to prevent memory growth.
 *
 * Usage:
 *   const cache = require('./cache');
 *   await cache.get('key')
 *   await cache.set('key', value, ttlSeconds)
 *   await cache.del('key')
 *   await cache.delByPattern('biz:firmId:*')
 *   await cache.flush()
 *
 * Key Naming Convention (always use these helpers):
 *   cache.keys.dashboard(firmId)
 *   cache.keys.stockSummary(firmId)
 *   cache.keys.gstr1(firmId, from, to)
 *   cache.keys.gstr3b(firmId, from, to)
 *   cache.keys.salesDetail(firmId, from, to, itemCode)
 *   cache.keys.stockDetail(firmId, from, to, itemCode)
 *   cache.keys.customers(firmId)
 *   cache.keys.items(firmId)
 */

// ─── TTL constants (seconds) ──────────────────────────────────────────────────
const TTL = {
  DASHBOARD: 60 * 5,   // 5 min
  REPORT:    60 * 15,  // 15 min
  LIST:      60 * 10,  // 10 min
  SHORT:     60 * 2,   // 2 min
};

// ─── Key Builders ─────────────────────────────────────────────────────────────
const keys = {
  dashboard:    (f)              => `biz:${f}:dashboard`,
  stockSummary: (f)              => `biz:${f}:stock-summary`,
  stockDetail:  (f, from, to, c) => `biz:${f}:stock-detail:${from||''}:${to||''}:${c||''}`,
  salesDetail:  (f, from, to, c) => `biz:${f}:sales-detail:${from||''}:${to||''}:${c||''}`,
  gstr1:        (f, from, to)    => `biz:${f}:gstr1:${from||''}:${to||''}`,
  gstr3b:       (f, from, to)    => `biz:${f}:gstr3b:${from||''}:${to||''}`,
  customers:    (f)              => `biz:${f}:customers`,
  items:        (f)              => `biz:${f}:items`,
  /** Pattern that matches ALL cached keys for a given firm */
  firmPattern:  (f)              => `biz:${f}:*`,
};

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
class MemoryCache {
  constructor() {
    this._store = new Map();
    // Evict expired entries every 5 min to prevent memory leak
    setInterval(() => this._evict(), 5 * 60 * 1000).unref();
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { this._store.delete(key); return null; }
    return entry.value;
  }

  async set(key, value, ttlSeconds = 300) {
    this._store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key) { this._store.delete(key); }

  async delByPattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of this._store.keys()) {
      if (regex.test(k)) this._store.delete(k);
    }
  }

  async flush() { this._store.clear(); }

  async size() { return this._store.size; }

  _evict() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now > v.expiresAt) this._store.delete(k);
    }
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────────
const cacheImpl = new MemoryCache();

// ─── Unified Public API ───────────────────────────────────────────────────────
const cache = {
  keys,
  TTL,

  async get(key)              { return cacheImpl.get(key); },
  async set(key, value, ttl)  { return cacheImpl.set(key, value, ttl); },
  async del(key)              { return cacheImpl.del(key); },
  async delByPattern(pattern) { return cacheImpl.delByPattern(pattern); },
  async flush()               { return cacheImpl.flush(); },
  async size()                { return cacheImpl.size(); },

  /**
   * Nuke ALL cached data for a given firm.
   * Call after any write that affects firm-wide state.
   */
  async invalidateFirm(firmId) {
    await cacheImpl.delByPattern(keys.firmPattern(firmId));
  },
};

module.exports = cache;
