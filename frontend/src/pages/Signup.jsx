import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setError(error.message);
    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1>Check your email</h1>
        <p>We sent a verification link to {email}. Confirm it, then log in.</p>
        <Link to="/login">Go to login</Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign up</button>
      </form>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
