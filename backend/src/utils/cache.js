/**
 * ─── BizManager Cache Layer ───────────────────────────────────────────────────
 *
 * Provides a unified cache interface that automatically falls back to an
 * in-memory TTL cache when Redis is unavailable (e.g. Electron desktop mode).
 *
 * Usage:
 *   const cache = require('./cache');
 *   await cache.get('key')
 *   await cache.set('key', value, ttlSeconds)
 *   await cache.del('key')
 *   await cache.delByPattern('biz:firmId:*')
 *   await cache.flush()
 *   cache.isRedis   // true if backed by Redis
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

const Redis = require('ioredis');

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

// ─── In-Memory Fallback ───────────────────────────────────────────────────────
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

// ─── Redis Adapter ────────────────────────────────────────────────────────────
class RedisCache {
  constructor(client) { this._client = client; }

  async get(key) {
    const raw = await this._client.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }

  async set(key, value, ttlSeconds = 300) {
    await this._client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async del(key) { await this._client.del(key); }

  async delByPattern(pattern) {
    // Use SCAN to avoid blocking KEYS in production
    let cursor = '0';
    do {
      const [nextCursor, found] = await this._client.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100
      );
      cursor = nextCursor;
      if (found.length) await this._client.del(...found);
    } while (cursor !== '0');
  }

  async flush() { await this._client.flushdb(); }

  async size() { return this._client.dbsize(); }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
let cacheImpl = new MemoryCache();
let isRedis   = false;

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  const client = new Redis(REDIS_URL, {
    lazyConnect:          false,
    connectTimeout:       3000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue:   false,
    retryStrategy:        () => null, // don't auto-retry so we fail fast
  });

  client.on('ready', () => {
    cacheImpl = new RedisCache(client);
    isRedis   = true;
    console.log('[Cache] ✅ Redis connected:', REDIS_URL);
  });

  client.on('error', (err) => {
    if (isRedis) {
      console.warn('[Cache] ⚠️  Redis error — falling back to in-memory cache:', err.message);
      cacheImpl = new MemoryCache();
      isRedis   = false;
    } else {
      // Suppress noisy connection-refused spam
      if (!err.message.includes('ECONNREFUSED')) {
        console.warn('[Cache] Redis error:', err.message);
      }
    }
  });
} else {
  console.log('[Cache] ℹ️  No REDIS_URL — using in-memory cache (Electron / dev mode)');
}

// ─── Unified Public API ───────────────────────────────────────────────────────
const cache = {
  get isRedis()                     { return isRedis; },
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
