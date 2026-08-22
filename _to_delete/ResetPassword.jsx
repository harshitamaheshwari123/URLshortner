import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate('/login'), 2000);
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1>Password updated</h1>
        <p className="success">Your password has been changed. Redirecting to login...</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="auth-card">
        <h1>Reset password</h1>
        <p className="hint">
          Open this page using the reset link from your email. If you got here directly,
          the link may have expired — go back and request a new one from the login page.
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Set a new password</h1>
      <form onSubmit={handleSubmit}>
        <label>New password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        <label>Confirm new password
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Update password</button>
      </form>
    </div>
  );
}
