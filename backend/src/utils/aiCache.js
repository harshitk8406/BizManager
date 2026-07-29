/**
 * Lightweight in-memory TTL cache for AI responses.
 * Avoids redundant Groq API calls for identical inputs.
 * Auto-evicts expired entries to prevent memory growth.
 */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

class AICache {
  constructor() {
    this._store = new Map();
    // Evict expired entries every 30 minutes
    setInterval(() => this._evict(), 30 * 60 * 1000).unref();
  }

  /**
   * Build a safe cache key from arbitrary parts.
   */
  key(...parts) {
    return parts.map(p => String(p).toLowerCase().trim()).join('|');
  }

  /**
   * Get a cached value. Returns undefined on miss or expiry.
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store a value with an optional TTL in milliseconds.
   */
  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  _evict() {
    const now = Date.now();
    for (const [k, v] of this._store) {
      if (now > v.expiresAt) this._store.delete(k);
    }
  }
}

// Singleton — shared across all AI controllers
module.exports = new AICache();
