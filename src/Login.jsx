import { useState } from 'react';

function Login({ setToken, setAuthMode, authError, setAuthError, authLoading }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      localStorage.setItem('token', data.token);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="App" style={{ maxWidth: 400, margin: '4em auto', padding: 24, border: '1px solid #ccc', borderRadius: 12 }}>
      <h2 style={{ textAlign: 'center' }}>Globetrotter Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: 8, fontSize: 16 }}
          />
        </div>
        <button type="submit" disabled={authLoading} style={{ width: '100%', padding: 10, fontSize: 16, marginBottom: 8 }}>
          Login
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button onClick={() => { setAuthMode('register'); setAuthError(null); }} style={{ fontSize: 14, background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>
          No account? Register
        </button>
      </div>
      {authError && <p style={{ color: 'red', textAlign: 'center' }}>{authError}</p>}
    </div>
  );
}

export default Login; 