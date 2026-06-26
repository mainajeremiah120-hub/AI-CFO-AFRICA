import axios from 'axios';
import { getCached, setCached, invalidateModule, clearCache } from './cache.js';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 15000, // fail fast after 15s — no hanging requests
});

// ── Request interceptor ──────────────────────────────────────────────────────
// Serve GET requests from the in-memory cache when possible.
// Mutations (POST/PUT/DELETE) skip the cache and go straight to the server.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (config.method === 'get' && config.url) {
    const cached = getCached(config.url);
    if (cached !== null) {
      // Swap in a custom adapter that resolves immediately with cached data —
      // no network round-trip at all.
      config.adapter = () =>
        Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        });
    }
  }

  return config;
});

// ── Response interceptor ─────────────────────────────────────────────────────
API.interceptors.response.use(
  (response) => {
    const { method, url } = response.config;

    if (method === 'get' && url) {
      // Store fresh GET responses in the cache.
      setCached(url, response.data);
    }

    if (['post', 'put', 'delete', 'patch'].includes(method) && url) {
      // Extract the module name from the URL path.
      // e.g. "/receivables/invoices/5" → module = "receivables"
      const module = url.split('/').filter(Boolean)[0];
      if (module) invalidateModule(module);
    }

    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearCache();
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
