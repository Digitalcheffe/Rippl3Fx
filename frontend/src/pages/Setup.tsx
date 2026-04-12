import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../theme';

const font = "'DM Mono', monospace";

export default function Setup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(data => {
        if (data.configured) navigate('/login', { replace: true });
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (data.success) {
      navigate('/login', { replace: true });
    } else {
      setError(data.error || 'Setup failed');
    }
  };

  if (loading) return null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: 360, background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: -0.5 }}>Rippl3FX</div>
          <div style={{ fontSize: 11, color: C.textSoft, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>First-time setup</div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: 14 }}>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#ffeaea', border: '1px solid #ffaaaa', borderRadius: 7, color: '#c00', fontSize: 12, fontFamily: font }}>
              {error}
            </div>
          )}

          <button type="submit" style={btnStyle}>
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: '#5a7fa8',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 5,
  fontFamily: "'DM Mono', monospace",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#e6eef8',
  border: '1px solid #cfe0f0',
  borderRadius: 7,
  color: '#0d1f35',
  fontSize: 13,
  fontFamily: "'DM Mono', monospace",
  boxSizing: 'border-box',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 20,
  padding: '10px 20px',
  background: '#e8622a',
  border: 'none',
  borderRadius: 7,
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.5,
};
