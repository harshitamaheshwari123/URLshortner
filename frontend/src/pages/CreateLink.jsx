import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';

export default function CreateLink() {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxClicks, setMaxClicks] = useState('');
  const [tags, setTags] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const navigate = useNavigate();

  async function handleAiSuggest() {
    if (!url) {
      setAiError('Enter a destination URL first');
      return;
    }
    setAiError('');
    setAiLoading(true);
    try {
      const suggestion = await api.suggestMetadata(url);
      if (suggestion.alias) setAlias(suggestion.alias);
      if (suggestion.tags?.length) setTags(suggestion.tags.join(', '));
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        destination_url: url,
        ...(alias ? { alias } : {}),
        ...(expiresAt ? { expires_at: new Date(expiresAt).toISOString() } : {}),
        ...(maxClicks ? { max_clicks: Number(maxClicks) } : {}),
        ...(tags ? { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) } : {}),
      };
      const data = await api.createLink(payload);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="auth-card">
        <h1>Link created</h1>
        <p className="short-url-result">{result.short_url}</p>
        <div className="toolbar-actions">
          <button onClick={() => navigator.clipboard.writeText(result.short_url)}>Copy</button>
          {user && <button onClick={() => navigate('/')}>Back to dashboard</button>}
          <button onClick={() => setResult(null)}>Create another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Shorten a URL</h1>
      <p className="hint">
        {user ? 'Logged in — you can set a custom alias, tags, and expiration.'
              : 'No login required for a basic short link. Log in to use custom aliases, tags, and expiration.'}
      </p>
      <form onSubmit={handleSubmit}>
        <label>Destination URL
          <input type="url" placeholder="https://example.com/very/long/path" value={url} onChange={(e) => setUrl(e.target.value)} required />
        </label>
        {user && (
          <>
            <div className="ai-suggest-row">
              <button type="button" className="link-button" onClick={handleAiSuggest} disabled={aiLoading}>
                {aiLoading ? 'Asking AI...' : '✨ AI Suggest alias + tags'}
              </button>
              {aiError && <span className="hint"> {aiError}</span>}
            </div>
            <label>Custom alias (optional)
              <input placeholder="my-sale" value={alias} onChange={(e) => setAlias(e.target.value)} minLength={3} maxLength={30} />
            </label>
            <label>Expires on (optional)
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </label>
            <label>Expire after this many clicks (optional)
              <input type="number" min="1" placeholder="e.g. 100" value={maxClicks} onChange={(e) => setMaxClicks(e.target.value)} />
            </label>
            <label>Tags (comma-separated, optional)
              <input placeholder="campaign, q3" value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Shorten'}</button>
      </form>
    </div>
  );
}
