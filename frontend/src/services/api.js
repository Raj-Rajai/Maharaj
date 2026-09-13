import axios from 'axios';

let rawBaseUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
if (!rawBaseUrl.endsWith('/api')) {
  rawBaseUrl = `${rawBaseUrl}/api`;
}
const BASE_URL = rawBaseUrl;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Auto-retry on 503 (Supabase connection drop) — up to 2 retries
    if (error.response?.status === 503 && error.response?.data?.retryable) {
      const retryCount = error.config._retryCount || 0;
      if (retryCount < 2) {
        error.config._retryCount = retryCount + 1;
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return api(error.config);
      }
    }

    const isAuthEndpoint = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', res.data.accessToken);
          if (error.config.headers?.set) {
            error.config.headers.set('Authorization', `Bearer ${res.data.accessToken}`);
          } else {
            error.config.headers = error.config.headers || {};
            error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          }
          return api(error.config);
        } catch (refreshErr) {
          // Only clear and redirect if the refresh token itself is genuinely invalid/expired (401)
          if (refreshErr.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/login';
          }
          return Promise.reject(refreshErr);
        }
      } else if (!refreshToken) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// CLIENT-SIDE API CACHING & DEDUPLICATION
// ==========================================
const memoryCache = new Map();
const inFlightRequests = new Map();
const SESSION_CACHE_PREFIX = 'mvv_api_cache:';
const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes default TTL

const normalizeCacheKey = (url, params) => {
  let key = (url || '').replace(/^\/api/, '');
  if (!key.startsWith('/')) key = `/${key}`;
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    const sorted = Object.keys(params)
      .sort()
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
      .join('&');
    if (sorted) key += (key.includes('?') ? '&' : '?') + sorted;
  }
  return key;
};

const getFromCache = (key) => {
  if (memoryCache.has(key)) {
    const item = memoryCache.get(key);
    if (item.expiresAt > Date.now()) return item;
    memoryCache.delete(key);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
      if (raw) {
        const item = JSON.parse(raw);
        if (item.expiresAt > Date.now()) {
          memoryCache.set(key, item);
          return item;
        }
        sessionStorage.removeItem(SESSION_CACHE_PREFIX + key);
      }
    }
  } catch {}
  return null;
};

const saveToCache = (key, data, headers, customTtl) => {
  const expiresAt = Date.now() + (customTtl || DEFAULT_TTL_MS);
  const entry = { data, headers, expiresAt };
  memoryCache.set(key, entry);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_CACHE_PREFIX + key, JSON.stringify(entry));
    }
  } catch {}
};

api.getCached = (url, params) => {
  const key = normalizeCacheKey(url, params);
  const item = getFromCache(key);
  return item ? item.data : null;
};

api.hasCached = (url, params) => {
  const key = normalizeCacheKey(url, params);
  return Boolean(getFromCache(key));
};

api.invalidateCache = (pattern) => {
  for (const k of memoryCache.keys()) {
    if (!pattern || k.includes(pattern)) memoryCache.delete(k);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
          const sub = k.slice(SESSION_CACHE_PREFIX.length);
          if (!pattern || sub.includes(pattern)) {
            sessionStorage.removeItem(k);
          }
        }
      }
    }
  } catch {}
};

api.clearCache = () => {
  api.invalidateCache();
};

const invalidateForMutation = (url) => {
  const u = (url || '').toLowerCase();
  if (u.includes('/table-session') || u.includes('/table') || u.includes('/order')) {
    api.invalidateCache('/tables');
    api.invalidateCache('/table-sessions');
    api.invalidateCache('/orders');
    api.invalidateCache('/reports');
    api.invalidateCache('/kots');
    api.invalidateCache('/bills');
  } else if (u.includes('/bill') || u.includes('/payment')) {
    api.invalidateCache('/bills');
    api.invalidateCache('/reports');
    api.invalidateCache('/tables');
    api.invalidateCache('/orders');
  } else if (u.includes('/menu')) {
    api.invalidateCache('/menu');
    api.invalidateCache('/reports');
  } else if (u.includes('/kot')) {
    api.invalidateCache('/kots');
    api.invalidateCache('/orders');
    api.invalidateCache('/reports');
  } else if (u.includes('/inventory') || u.includes('/purchase') || u.includes('/supplier')) {
    api.invalidateCache('/inventory');
    api.invalidateCache('/purchases');
    api.invalidateCache('/suppliers');
    api.invalidateCache('/reports');
  } else if (u.includes('/setting')) {
    api.invalidateCache('/settings');
    api.invalidateCache('/reports');
    api.invalidateCache('/bills');
  } else if (u.includes('/user')) {
    api.invalidateCache('/users');
  } else {
    api.clearCache();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos:cache-invalidated', { detail: { url } }));
  }
};

// Live operational endpoints must NEVER be served from stale client cache
// This ensures all devices (captains, kitchen, cashiers) always see live state without F5
const LIVE_OPERATIONAL_PATTERNS = [
  '/tables',
  '/table-sessions',
  '/orders',
  '/kots',
  '/bills',
  '/online-orders',
];

const isLiveOperationalEndpoint = (url) => {
  const u = (url || '').toLowerCase();
  return LIVE_OPERATIONAL_PATTERNS.some((pattern) => u.includes(pattern));
};

// Purge any legacy cached live data from sessionStorage on load
try {
  if (typeof sessionStorage !== 'undefined') {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
        if (isLiveOperationalEndpoint(k)) {
          sessionStorage.removeItem(k);
        }
      }
    }
  }
} catch {}

// Wrap api.get with cache checking & deduplication
const originalGet = api.get.bind(api);
api.get = async (url, config = {}) => {
  const skipCache = config.skipCache || config.headers?.['x-skip-cache'] === 'true';
  const isLive = isLiveOperationalEndpoint(url);
  const shouldCache = !skipCache && !isLive && !url.includes('/auth/');

  if (shouldCache) {
    const cacheKey = normalizeCacheKey(url, config.params);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        status: 200,
        statusText: 'OK (cached)',
        headers: cached.headers || {},
        config,
        fromCache: true,
      };
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
      try {
        const response = await originalGet(url, config);
        saveToCache(cacheKey, response.data, response.headers, config.ttl);
        return response;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  // Live operational endpoint or explicit skipCache: always fetch directly from server
  const response = await originalGet(url, config);
  // Only save to cache if it's NOT a live operational endpoint and NOT auth
  if (!isLive && !url.includes('/auth/') && !skipCache) {
    const cacheKey = normalizeCacheKey(url, config.params);
    saveToCache(cacheKey, response.data, response.headers, config.ttl);
  }
  return response;
};

// Wrap mutations to auto-invalidate related cache
const originalPost = api.post.bind(api);
const originalPut = api.put.bind(api);
const originalPatch = api.patch.bind(api);
const originalDelete = api.delete.bind(api);

api.post = async (url, data, config) => {
  const res = await originalPost(url, data, config);
  invalidateForMutation(url);
  return res;
};

api.put = async (url, data, config) => {
  const res = await originalPut(url, data, config);
  invalidateForMutation(url);
  return res;
};

api.patch = async (url, data, config) => {
  const res = await originalPatch(url, data, config);
  invalidateForMutation(url);
  return res;
};

api.delete = async (url, config) => {
  const res = await originalDelete(url, config);
  invalidateForMutation(url);
  return res;
};

export default api;
