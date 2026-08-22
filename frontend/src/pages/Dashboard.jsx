import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Dashboard() {
  const [links, setLinks] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listLinks({ sort, order: 'desc', ...(search ? { search } : {}) });
      setLinks(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [sort]);

  function toggleSelect(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function bulkArchive() {
    if (selected.size === 0) return;
    await api.bulkArchive([...selected], true);
    setSelected(new Set());
    load();
  }

  function shortUrlFor(shortCode) {
    const base = import.meta.env.VITE_API_BASE_URL;
    return `${base}/${shortCode}`;
  }

  async function copyShortUrl(link) {
    await navigator.clipboard.writeText(shortUrlFor(link.short_code));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((current) => (current === link.id ? null : current)), 1500);
  }

  return (
    <div>
      <div className="toolbar">
        <h1>Your links</h1>
        <div className="toolbar-actions">
          <input
            placeholder="Search by URL or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button onClick={load}>Search</button>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="created_at">Newest</option>
            <option value="click_count">Most clicked</option>
            <option value="expires_at">Expiring soon</option>
          </select>
          <Link to="/create" className="button-primary">+ New link</Link>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <button onClick={bulkArchive}>Archive selected</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p>Loading...</p>
      ) : links.length === 0 ? (
        <p>No links yet. Create your first one.</p>
      ) : (
        <div className="table-scroll">
        <table className="link-table">
          <thead>
            <tr>
              <th></th>
              <th>Short link</th>
              <th>Destination</th>
              <th>Clicks</th>
              <th>Tags</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} className={link.is_archived ? 'archived-row' : ''}>
                <td><input type="checkbox" checked={selected.has(link.id)} onChange={() => toggleSelect(link.id)} /></td>
                <td>
                  <div className="short-link-cell">
                    <a href={shortUrlFor(link.short_code)} target="_blank" rel="noreferrer" title="Open this short link">
                      /{link.short_code}
                    </a>
                    <button className="link-button" onClick={() => copyShortUrl(link)} title="Copy short URL">
                      {copiedId === link.id ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </td>
                <td className="truncate">{link.destination_url}</td>
                <td>{link.click_count}</td>
                <td>{(link.tags || []).join(', ')}</td>
                <td>{link.expires_at ? new Date(link.expires_at).toLocaleDateString() : '—'}</td>
                <td><Link to={`/links/${link.id}`}>Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
