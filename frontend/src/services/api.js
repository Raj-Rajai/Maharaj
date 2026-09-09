import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
          const res = await axios.post('/api/auth/refresh', { refreshToken });
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

export default api;
