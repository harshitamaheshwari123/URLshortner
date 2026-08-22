import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';
import { api } from '../lib/api.js';

export default function LinkDetail() {
  const { id } = useParams();
  const [link, setLink] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [destUrl, setDestUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [alias, setAlias] = useState('');
  const [maxClicks, setMaxClicks] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [linkData, analyticsData] = await Promise.all([api.getLink(id), api.getAnalytics(id)]);
      setLink(linkData);
      setAnalytics(analyticsData);
      setDestUrl(linkData.destination_url);
      setExpiresAt(linkData.expires_at ? linkData.expires_at.slice(0, 10) : '');
      setAlias(linkData.short_code);
      setMaxClicks(linkData.max_clicks ?? '');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function loadQr() {
    const url = await api.qrCodeUrl(id);
    setQrUrl(url);
  }

  async function saveEdits() {
    try {
      await api.updateLink(id, {
        destination_url: destUrl,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        max_clicks: maxClicks ? Number(maxClicks) : null,
        ...(alias !== link.short_code ? { alias } : {}),
      });
      setEditing(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function exportCsv() {
    const base = import.meta.env.VITE_API_BASE_URL;

    window.open(`${base}/api/analytics/${id}/export.csv`, '_blank');
  }

  if (error) return <p className="error">{error}</p>;
  if (!link || !analytics) return <p>Loading...</p>;

  return (
    <div>
      <h1>/{link.short_code}</h1>

      {editing ? (
        <div className="edit-box">
          <label>Short code (alias)
            <input value={alias} onChange={(e) => setAlias(e.target.value)} minLength={3} maxLength={30} />
          </label>
          <label>Destination URL
            <input value={destUrl} onChange={(e) => setDestUrl(e.target.value)} />
          </label>
          <label>Expires on
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
          <label>Expire after this many clicks (blank = no limit)
            <input type="number" min="1" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} />
          </label>
          <div className="toolbar-actions">
            <button onClick={saveEdits}>Save</button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="link-meta">
          <p><strong>Destination:</strong> {link.destination_url}</p>
          <p><strong>Tags:</strong> {(link.tags || []).join(', ') || '—'}</p>
          <p><strong>Expires:</strong> {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : 'Never'}</p>
          <p><strong>Click limit:</strong> {link.max_clicks ? `${link.click_count} / ${link.max_clicks} clicks` : 'No limit'}</p>
          <div className="toolbar-actions">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button onClick={loadQr}>Show QR code</button>
            <button onClick={exportCsv}>Export analytics CSV</button>
          </div>
          {qrUrl && <img src={qrUrl} alt="QR code" className="qr-image" />}
        </div>
      )}

      <h2>Analytics</h2>
      <p>Total clicks: {analytics.total_clicks}</p>

      <div className="chart-block">
        <h3>Clicks over time</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={analytics.clicks_over_time}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-row">
        <div className="chart-block">
          <h3>Top referrers</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.top_referrers}>
              <XAxis dataKey="key" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-block">
          <h3>Device breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.device_breakdown}>
              <XAxis dataKey="key" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-block">
        <h3>Top locations</h3>
        {analytics.geo_breakdown.every((g) => g.key === 'unknown') ? (
          <p className="hint">
            No location data yet. This fills in once clicks come from real public IP
            addresses (won't show anything while testing on localhost).
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.geo_breakdown}>
              <XAxis dataKey="key" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#d97706" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
