// Server-side in-memory cache for read-heavy reference data
// Only for: menus, categories, tables, settings, permissions
// Database remains source of truth — cache invalidated on writes

const caches = new Map();

/**
 * Create a named cache with a TTL.
 * @param {string} name - cache key
 * @param {number} ttlMs - time-to-live in milliseconds
 * @returns {{ get, set, invalidate }}
 */
export function createCache(name, ttlMs = 60_000) {
  const entry = { data: null, expiresAt: 0 };
  caches.set(name, entry);

  return {
    /** Get cached value, or null if expired/missing */
    get() {
      if (entry.data !== null && Date.now() < entry.expiresAt) {
        return entry.data;
      }
      return null;
    },

    /** Set cached value */
    set(data) {
      entry.data = data;
      entry.expiresAt = Date.now() + ttlMs;
    },

    /** Invalidate this cache immediately */
    invalidate() {
      entry.data = null;
      entry.expiresAt = 0;
    },
  };
}

/**
 * Invalidate ALL caches (use after bulk operations)
 */
export function invalidateAll() {
  for (const entry of caches.values()) {
    entry.data = null;
    entry.expiresAt = 0;
  }
}

// Pre-defined caches for reference data
// 60s TTL — frequently read, rarely written
const _menuSubs = {
  AC: createCache('menu_ac', 60_000),
  NON_AC: createCache('menu_nonac', 60_000),
  SWIGGY: createCache('menu_swiggy', 60_000),
  ZOMATO: createCache('menu_zomato', 60_000),
  ALL: createCache('menu_all', 60_000),
};

export const menuCache = {
  // Named sub-caches (lowercase keys for direct access)
  ac: _menuSubs.AC,
  nonAc: _menuSubs.NON_AC,
  swiggy: _menuSubs.SWIGGY,
  zomato: _menuSubs.ZOMATO,
  all: _menuSubs.ALL,
  // Convenience methods that route by menuType key (AC, NON_AC, SWIGGY, ZOMATO, ALL)
  get(key) { return (_menuSubs[key] || _menuSubs.ALL).get(); },
  set(key, data) { (_menuSubs[key] || _menuSubs.ALL).set(data); },
};

export const categoryCache = createCache('categories', 60_000);
export const tableCache = createCache('tables', 30_000); // 30s — tables change status more often
export const settingsCache = createCache('settings', 120_000); // 2min — rarely changes

// Keyed cache for authenticated user active/role check and profile (30s TTL)
const _userAuthMap = new Map();
const _userProfileMap = new Map();

export const userAuthCache = {
  get(userId) {
    const entry = _userAuthMap.get(userId);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }
    _userAuthMap.delete(userId);
    return null;
  },
  set(userId, data) {
    _userAuthMap.set(userId, { data, expiresAt: Date.now() + 30_000 });
  },
  getProfile(userId) {
    const entry = _userProfileMap.get(userId);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }
    _userProfileMap.delete(userId);
    return null;
  },
  setProfile(userId, data) {
    _userProfileMap.set(userId, { data, expiresAt: Date.now() + 30_000 });
  },
  invalidate(userId) {
    if (userId) {
      _userAuthMap.delete(userId);
      _userProfileMap.delete(userId);
    } else {
      _userAuthMap.clear();
      _userProfileMap.clear();
    }
  }
};

/**
 * Invalidate all menu caches and category cache (since category has menuItems _count)
 */
export function invalidateMenuCaches() {
  for (const cache of Object.values(_menuSubs)) {
    cache.invalidate();
  }
  categoryCache.invalidate();
}
