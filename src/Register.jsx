import { useState } from 'react';

function Register({ setAuthMode, authError, setAuthError, authLoading }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setSuccess(false);
    try {
      const res = await fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setSuccess(true);
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="App" style={{ maxWidth: 400, margin: '4em auto', padding: 24, border: '1px solid #ccc', borderRadius: 12 }}>
      <h2 style={{ textAlign: 'center' }}>Register for Globetrotter</h2>
      <form onSubmit={handleRegister}>
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
          Register
        </button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button onClick={() => { setAuthMode('login'); setAuthError(null); }} style={{ fontSize: 14, background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>
          Already have an account? Login
        </button>
      </div>
      {success && <p style={{ color: 'green', textAlign: 'center' }}>Registration successful! Please log in.</p>}
      {authError && <p style={{ color: 'red', textAlign: 'center' }}>{authError}</p>}
    </div>
  );
}

export default Register; 