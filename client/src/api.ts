import axios, { AxiosError } from 'axios';
import { addToQueue, getQueueCount, syncQueue } from './offlineQueue';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Cache traders data for offline use
export function cacheTraders(data: any[]) {
  try { localStorage.setItem('cached_traders', JSON.stringify(data)); } catch {}
}

export function getCachedTraders(): any[] {
  try { return JSON.parse(localStorage.getItem('cached_traders') || '[]'); } catch { return []; }
}

// Write operations that can be queued offline
const WRITE_METHODS = ['post', 'put', 'delete'];
const WRITE_URLS = ['/transactions/', '/traders', '/users'];

function isWriteOp(method: string, url: string): boolean {
  if (!WRITE_METHODS.includes(method.toLowerCase())) return false;
  return WRITE_URLS.some((u) => url.includes(u));
}

function isNetworkError(error: AxiosError): boolean {
  return !error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || !navigator.onLine);
}

// Response interceptor: queue writes on network failure
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const config = error.config;
    if (config && isNetworkError(error) && isWriteOp(config.method || '', config.url || '')) {
      await addToQueue(config.method || 'post', config.url || '', config.data ? JSON.parse(config.data) : {});
      window.dispatchEvent(new CustomEvent('offline-queue-update'));
      return { data: { message: 'تم التسجيل - في انتظار الاتصال', _offline: true }, status: 200 };
    }

    return Promise.reject(error);
  }
);

// Sync pending operations when online
export async function syncPendingOps(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));

  const result = await syncQueue(async (method, url, data) => {
    try {
      await axios({ method, url: `/api${url}`, data, headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      return true;
    } catch { return false; }
  });

  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'done' }));
  window.dispatchEvent(new CustomEvent('offline-queue-update'));
  return result;
}

export { getQueueCount };
export default api;
