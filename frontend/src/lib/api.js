import { supabase } from './supabase.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  createLink: (payload) => request('/api/links', { method: 'POST', body: JSON.stringify(payload) }),
  listLinks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/links${qs ? `?${qs}` : ''}`);
  },
  getLink: (id) => request(`/api/links/${id}`),
  updateLink: (id, payload) => request(`/api/links/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteLink: (id) => request(`/api/links/${id}`, { method: 'DELETE' }),
  bulkArchive: (ids, archived = true) =>
    request('/api/links/bulk-archive', { method: 'POST', body: JSON.stringify({ ids, archived }) }),
  getAnalytics: (linkId) => request(`/api/analytics/${linkId}`),
  suggestMetadata: (destination_url) =>
    request('/api/ai/suggest-metadata', { method: 'POST', body: JSON.stringify({ destination_url }) }),
  qrCodeUrl: async (linkId) => {
    const headers = await authHeader();

    const res = await fetch(`${API_BASE}/api/links/${linkId}/qrcode`, { headers });
    if (!res.ok) throw new Error('Could not load QR code');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
