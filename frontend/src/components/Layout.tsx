import { useNavigate, useLocation } from 'react-router-dom';
import { C } from '../theme';

const font = "'DM Mono', monospace";

const NAV_ITEMS = [
  { key: '/', label: 'All Metrics', color: C.accent },
  { key: '/github', label: 'GitHub', color: C.GitHub },
  { key: '/ga4', label: 'GA4', color: C.GA4 },
  { key: '/bing', label: 'Bing', color: C.Bing },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (key: string) => {
    if (key === '/') return location.pathname === '/';
    return location.pathname.startsWith(key);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: font }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
      `}</style>

      {/* Nav */}
      <div style={{
        background: C.bgNav,
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 12px rgba(13,31,53,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Wordmark */}
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5, fontFamily: font, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <span style={{ color: C.accent }}>Rippl</span>
            <span style={{ color: C.GA4 }}>3</span>
            <span style={{ color: '#ffffff' }}>FX</span>
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 1 }}>
            {NAV_ITEMS.map(nav => {
              const active = isActive(nav.key);
              return (
                <button
                  key={nav.key}
                  onClick={() => navigate(nav.key)}
                  style={{
                    padding: '5px 12px',
                    background: active ? 'rgba(255,255,255,0.1)' : 'none',
                    border: 'none',
                    borderRadius: 6,
                    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    fontWeight: active ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: font,
                    letterSpacing: 0.3,
                    borderBottom: active ? `2px solid ${nav.color}` : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {nav.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={() => navigate('/settings')}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            padding: '5px 14px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
            cursor: 'pointer',
            fontFamily: font,
            letterSpacing: 0.8,
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 28px 48px' }}>
        {children}
      </div>
    </div>
  );
}
