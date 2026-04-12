import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { C } from '../theme';

const font = "'DM Mono', monospace";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  const [error, setError] = useState('');
  const totpRef = useRef<HTMLInputElement>(null);

  // Check if app is configured
  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(data => {
        if (!data.configured) navigate('/setup', { replace: true });
      });
  }, [navigate]);

  // Auto-focus TOTP input when step changes
  useEffect(() => {
    if (totpRequired && totpRef.current) {
      totpRef.current.focus();
    }
  }, [totpRequired]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await login(username, password);
    if (result.success) {
      navigate('/', { replace: true });
    } else if (result.totpRequired) {
      setTotpRequired(true);
    } else {
      setError(result.error || 'Login failed');
    }
  };

  const handleTotp = async (code: string) => {
    setTotpCode(code);
    if (code.length !== 6) return;

    setError('');
    const result = await login(username, password, code);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'Invalid code');
      setTotpCode('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
      <div style={{ width: 360, background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: -0.5 }}>Rippl3FX</div>
          <div style={{ fontSize: 11, color: C.textSoft, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
            {totpRequired ? 'Two-factor authentication' : 'Sign in'}
          </div>
        </div>

        {!totpRequired ? (
          <form onSubmit={handleLogin}>
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

            {error && <div style={errorStyle}>{error}</div>}

            <button type="submit" style={btnStyle}>Sign In</button>
          </form>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: C.textMid, textAlign: 'center', marginBottom: 16, lineHeight: 1.6 }}>
              Enter the 6-digit code from your authenticator app.
            </div>
            <input
              ref={totpRef}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={e => handleTotp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
            />

            {error && <div style={errorStyle}>{error}</div>}

            <button
              onClick={() => { setTotpRequired(false); setTotpCode(''); setError(''); }}
              style={{ width: '100%', marginTop: 14, padding: '8px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 7, color: C.textMid, fontSize: 11, cursor: 'pointer', fontFamily: font }}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  color: C.textSoft,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 5,
  fontFamily: "'DM Mono', monospace",
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: C.bgInput,
  border: `1px solid ${C.border}`,
  borderRadius: 7,
  color: C.text,
  fontSize: 13,
  fontFamily: "'DM Mono', monospace",
  boxSizing: 'border-box',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 20,
  padding: '10px 20px',
  background: C.accent,
  border: 'none',
  borderRadius: 7,
  color: '#fff',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'DM Mono', monospace",
  letterSpacing: 0.5,
};

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '8px 12px',
  background: '#ffeaea',
  border: '1px solid #ffaaaa',
  borderRadius: 7,
  color: '#c00',
  fontSize: 12,
  fontFamily: "'DM Mono', monospace",
};
