import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.jsx';
import { supabase } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LinkDetail from './pages/LinkDetail.jsx';
import CreateLink from './pages/CreateLink.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Loading...</p>;
  return user ? <Dashboard /> : <CreateLink />;
}

export default function App() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="navbar">
        <Link to="/" className="brand">LinkSnip</Link>
        <nav>
          {user ? (
            <>
              <Link to="/">Dashboard</Link>
              <Link to="/create">New link</Link>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/create">Shorten a URL</Link>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/create" element={<CreateLink />} />
          <Route path="/" element={<Home />} />
          <Route
            path="/links/:id"
            element={
              <ProtectedRoute>
                <LinkDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
