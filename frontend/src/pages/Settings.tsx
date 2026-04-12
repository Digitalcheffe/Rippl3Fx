import { useState, useEffect } from 'react';
import { C } from '../theme';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client';
import PlatformPill from '../components/PlatformPill';

const font = "'DM Mono', monospace";

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: C.bgInput,
  border: `1px solid ${C.border}`, borderRadius: 7, color: C.text,
  fontSize: 13, fontFamily: font, boxSizing: 'border-box', outline: 'none',
};
const btnP: React.CSSProperties = {
  padding: '8px 20px', background: C.accent, border: 'none', borderRadius: 7,
  color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: font,
};
const labelStyle: React.CSSProperties = {
  fontSize: 10, color: C.textSoft, display: 'block', marginBottom: 5,
  fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8,
};

const PLATFORMS = ['Reddit', 'GitHub', 'GA4', 'Bing'];

interface Account {
  id: number;
  platform: string;
  display_name: string;
  polling_interval_min: number;
  is_active: number;
  last_polled_at: string | null;
  created_at: string;
}

const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; type?: string }>> = {
  reddit: [
    { key: 'username', label: 'Reddit Username' },
    { key: 'password', label: 'Reddit Password', type: 'password' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password' },
  ],
  github: [
    { key: 'personalAccessToken', label: 'Personal Access Token', type: 'password' },
  ],
  ga4: [
    { key: 'propertyId', label: 'Property ID' },
    { key: 'serviceAccountJson', label: 'Service Account JSON' },
  ],
  bing: [
    { key: 'siteUrl', label: 'Site URL' },
    { key: 'apiKey', label: 'API Key', type: 'password' },
  ],
};

export default function Settings() {
  const { user, checkAuth } = useAuth();
  const [tab, setTab] = useState('profile');
  const tabs = [
    { k: 'profile', l: 'Profile' },
    { k: 'accounts', l: 'Platform Accounts' },
    { k: 'logs', l: 'Poll Logs' },
  ];

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Settings</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font, marginBottom: 20 }}>Settings</h1>

      <div style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: 14, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: '10px 4px', background: 'none', border: 'none',
              borderBottom: tab === t.k ? `2px solid ${C.accent}` : '2px solid transparent',
              color: tab === t.k ? C.accent : C.textSoft,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font,
              textTransform: 'uppercase', letterSpacing: 0.8,
            }}>
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ padding: 22 }}>
          {tab === 'profile' && (
            <>
              <ProfileTab user={user} onUpdate={checkAuth} />
              <div style={{ borderTop: `1px solid ${C.border}`, margin: '20px 0' }} />
              <PasswordTab />
              <div style={{ borderTop: `1px solid ${C.border}`, margin: '20px 0' }} />
              <TOTPTab user={user} onUpdate={checkAuth} />
            </>
          )}
          {tab === 'accounts' && <AccountsTab />}
          {tab === 'logs' && <LogsTab />}
        </div>
      </div>
    </div>
  );
}

// ── Profile Tab ──
function ProfileTab({ user }: { user: any; onUpdate: () => void }) {
  const [username, setUsername] = useState(user?.username || '');
  const [msg, setMsg] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} style={inp} />
      </div>
      {msg && <div style={{ fontSize: 12, color: C.up, fontFamily: font }}>{msg}</div>}
      <button style={{ ...btnP, alignSelf: 'flex-start' }} onClick={async () => {
        // Username is read-only for now (single user)
        setMsg('Profile saved');
        setTimeout(() => setMsg(''), 2000);
      }}>Save Changes</button>
    </div>
  );
}

// ── Password Tab ──
function PasswordTab() {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError(''); setMsg('');
    if (newPw !== confirm) { setError('Passwords do not match'); return; }
    if (newPw.length < 8) { setError('Password must be at least 8 characters'); return; }
    try {
      await apiPost('/auth/change-password', { currentPassword: current, newPassword: newPw });
      setMsg('Password updated');
      setCurrent(''); setNewPw(''); setConfirm('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {['Current Password', 'New Password', 'Confirm Password'].map((l, i) => (
        <div key={l}>
          <label style={labelStyle}>{l}</label>
          <input type="password" style={inp}
            value={[current, newPw, confirm][i]}
            onChange={e => [setCurrent, setNewPw, setConfirm][i](e.target.value)}
          />
        </div>
      ))}
      {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font }}>{error}</div>}
      {msg && <div style={{ fontSize: 12, color: C.up, fontFamily: font }}>{msg}</div>}
      <button style={{ ...btnP, alignSelf: 'flex-start' }} onClick={handleSubmit}>Update Password</button>
    </div>
  );
}

// ── TOTP Tab ──
function TOTPTab({ user, onUpdate }: { user: any; onUpdate: () => void }) {
  const [qrCode, setQrCode] = useState('');
  const [_secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const isEnabled = user?.totp_enabled;

  const handleSetup = async () => {
    setError('');
    try {
      const data = await apiPost<{ secret: string; qrCode: string }>('/auth/totp/setup');
      setSecret(data.secret);
      setQrCode(data.qrCode);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVerify = async (value: string) => {
    setCode(value);
    if (value.length !== 6) return;
    try {
      await apiPost('/auth/totp/verify', { code: value });
      setMsg('2FA enabled');
      setQrCode(''); setSecret(''); setCode('');
      onUpdate();
    } catch (err: any) {
      setError(err.message);
      setCode('');
    }
  };

  const handleDisable = async () => {
    try {
      await apiPost('/auth/totp/disable');
      setMsg('2FA disabled');
      onUpdate();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isEnabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '10px 14px', background: C.Bing + '15', border: `1px solid ${C.Bing}40`, borderRadius: 8, color: C.Bing, fontSize: 12, fontFamily: font }}>
          Two-factor authentication is enabled
        </div>
        <p style={{ margin: 0, fontSize: 12, color: C.textMid, lineHeight: 1.7, fontFamily: font }}>
          TOTP is active. Use your authenticator app on each login.
        </p>
        {msg && <div style={{ fontSize: 12, color: C.up, fontFamily: font }}>{msg}</div>}
        {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleSetup} style={{ padding: '8px 16px', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 7, color: C.textMid, fontSize: 12, cursor: 'pointer', fontFamily: font }}>Regenerate QR</button>
          <button onClick={handleDisable} style={{ padding: '8px 16px', background: C.bgInput, border: '1px solid #e8380d55', borderRadius: 7, color: '#e8380d', fontSize: 12, cursor: 'pointer', fontFamily: font }}>Disable 2FA</button>
        </div>
        {qrCode && (
          <div style={{ textAlign: 'center' }}>
            <img src={qrCode} alt="TOTP QR Code" style={{ width: 200, height: 200 }} />
            <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, marginTop: 8 }}>Scan with your authenticator app</div>
            <div>
              <label style={{ ...labelStyle, marginTop: 14 }}>Verify Code</label>
              <input type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={e => handleVerify(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ ...inp, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700, maxWidth: 200, margin: '0 auto' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 12, color: C.textMid, lineHeight: 1.7, fontFamily: font }}>
        Two-factor authentication adds an extra layer of security. You'll need an authenticator app like Google Authenticator or Authy.
      </p>
      {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font }}>{error}</div>}
      {msg && <div style={{ fontSize: 12, color: C.up, fontFamily: font }}>{msg}</div>}
      {!qrCode ? (
        <button onClick={handleSetup} style={{ ...btnP, alignSelf: 'flex-start' }}>Enable 2FA</button>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <img src={qrCode} alt="TOTP QR Code" style={{ width: 200, height: 200 }} />
          <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, marginTop: 8 }}>Scan with your authenticator app, then enter the code below</div>
          <div style={{ marginTop: 14 }}>
            <input type="text" inputMode="numeric" maxLength={6} value={code}
              onChange={e => handleVerify(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ ...inp, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700, maxWidth: 200, margin: '0 auto' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Accounts Tab ──
function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [defaultPlatform, setDefaultPlatform] = useState('github');

  const loadAccounts = async () => {
    try {
      const data = await apiGet<Account[]>('/accounts');
      setAccounts(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadAccounts(); }, []);

  const connectedPlatforms = accounts.map(a => a.platform);

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this account? All tracked items will be deleted.')) return;
    await apiDelete(`/accounts/${id}`);
    loadAccounts();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {accounts.map(a => {
        const platformName = a.platform.charAt(0).toUpperCase() + a.platform.slice(1);
        const displayPlatform = a.platform === 'ga4' ? 'GA4' : platformName;
        return (
          <div key={a.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <PlatformPill platform={displayPlatform} />
              <div style={{ fontSize: 10, color: C.textFaint, marginTop: 5, fontFamily: font }}>
                {a.display_name} · polls every {a.polling_interval_min} min
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditAccount(a); setShowModal(true); }} style={{ padding: '4px 10px', background: 'none', border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMid, fontSize: 11, cursor: 'pointer', fontFamily: font }}>Edit</button>
              <button onClick={() => handleDelete(a.id)} style={{ padding: '4px 10px', background: 'none', border: '1px solid #e8380d55', borderRadius: 5, color: '#e8380d', fontSize: 11, cursor: 'pointer', fontFamily: font }}>Remove</button>
            </div>
          </div>
        );
      })}

      {PLATFORMS.filter(p => !connectedPlatforms.includes(p.toLowerCase())).map(p => (
        <div key={p} style={{ background: C.bg, border: `1px dashed ${C.borderMid}`, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textFaint, fontFamily: font }}>{p} — not connected</span>
          <button onClick={() => { setEditAccount(null); setDefaultPlatform(p.toLowerCase()); setShowModal(true); }} style={{
            padding: '4px 12px', background: (C[p as keyof typeof C] || C.accent) + '15',
            border: `1px solid ${(C[p as keyof typeof C] || C.accent)}40`,
            borderRadius: 5, color: C[p as keyof typeof C] || C.accent,
            fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font,
          }}>Connect</button>
        </div>
      ))}

      <button onClick={() => { setEditAccount(null); setDefaultPlatform('github'); setShowModal(true); }} style={{ marginTop: 4, ...btnP, alignSelf: 'flex-start' }}>+ Add Account</button>

      {showModal && (
        <AccountModal
          account={editAccount}
          defaultPlatform={defaultPlatform}
          onClose={() => { setShowModal(false); setEditAccount(null); }}
          onSaved={() => { setShowModal(false); setEditAccount(null); loadAccounts(); }}
        />
      )}
    </div>
  );
}

// ── Account Modal ──
function AccountModal({ account, defaultPlatform, onClose, onSaved }: { account: Account | null; defaultPlatform: string; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!account;
  const [platform, setPlatform] = useState(account?.platform || defaultPlatform);
  const [displayName, setDisplayName] = useState(account?.display_name || '');
  const [interval, setInterval] = useState(account?.polling_interval_min || 60);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const fields = CREDENTIAL_FIELDS[platform] || [];

  const handleSave = async () => {
    setError('');
    if (!displayName.trim()) { setError('Display name is required'); return; }

    try {
      if (isEdit) {
        const body: any = { display_name: displayName, polling_interval_min: interval };
        const hasCredValues = Object.values(creds).some(v => v.trim());
        if (hasCredValues) body.credentials = creds;
        await apiPut(`/accounts/${account!.id}`, body);
      } else {
        const hasAllCreds = fields.every(f => creds[f.key]?.trim());
        if (!hasAllCreds) { setError('All credential fields are required'); return; }
        await apiPost('/accounts', {
          platform, display_name: displayName,
          credentials: creds, polling_interval_min: interval,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,53,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: 14, width: 440, padding: 22, boxShadow: '0 24px 64px rgba(13,31,53,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: font }}>{isEdit ? 'Edit Account' : 'Add Account'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 18, cursor: 'pointer' }}>x</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isEdit && (
            <div>
              <label style={labelStyle}>Platform</label>
              <select value={platform} onChange={e => { setPlatform(e.target.value); setCreds({}); }} style={{ ...inp, cursor: 'pointer' }}>
                {PLATFORMS.map(p => <option key={p} value={p.toLowerCase()}>{p}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Display Name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp} placeholder={`My ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`} />
          </div>

          <div>
            <label style={labelStyle}>Polling Interval (minutes)</label>
            <input type="number" min={1} value={interval} onChange={e => setInterval(Number(e.target.value))} style={inp} />
          </div>

          <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
            Credentials {isEdit && '(leave blank to keep current)'}
          </div>

          {fields.map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input type={f.type || 'text'} value={creds[f.key] || ''} onChange={e => setCreds({ ...creds, [f.key]: e.target.value })}
                style={inp} placeholder={isEdit ? '(unchanged)' : ''} />
            </div>
          ))}

          {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={handleSave} style={btnP}>{isEdit ? 'Save Changes' : 'Connect'}</button>
            <button onClick={onClose} style={{ ...btnP, background: C.bgInput, color: C.textMid }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Logs Tab ──
interface PollLog {
  id: number;
  metric_account_id: number;
  tracked_item_id: number | null;
  platform: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

function LogsTab() {
  const [logs, setLogs] = useState<PollLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (p: number) => {
    setLoading(true);
    try {
      const data = await apiGet<{ logs: PollLog[]; totalPages: number }>(`/logs?page=${p}&limit=100`);
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadLogs(page); }, [page]);

  const levelColor = (level: string) => {
    if (level === 'error') return '#c00';
    if (level === 'warn') return C.GA4;
    return C.up;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.textMid, fontFamily: font }}>
          Page {page} of {totalPages}
        </div>
        <button onClick={() => loadLogs(page)} style={{
          padding: '4px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 5, color: C.textMid, fontSize: 11, cursor: 'pointer', fontFamily: font,
        }}>Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: C.textSoft, fontSize: 12, fontFamily: font }}>Loading...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.textSoft, fontSize: 13, fontFamily: font }}>
          No poll logs yet. Logs appear after polling runs.
        </div>
      ) : (
        <>
          {logs.map(log => (
            <div key={log.id} style={{
              background: log.level === 'error' ? '#ffeaea' : C.bg,
              border: `1px solid ${log.level === 'error' ? '#ffaaaa' : C.border}`,
              borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: font,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: levelColor(log.level), fontWeight: 700, textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>{log.level}</span>
                  <span style={{ color: C[log.platform.charAt(0).toUpperCase() + log.platform.slice(1) as keyof typeof C] || C.textMid, fontWeight: 600, fontSize: 10 }}>
                    {log.platform.toUpperCase()}
                  </span>
                </div>
                <span style={{ color: C.textFaint, fontSize: 9 }}>
                  {new Date(log.created_at + 'Z').toLocaleString()}
                </span>
              </div>
              <div style={{ color: C.text, lineHeight: 1.4 }}>{log.message}</div>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{
                padding: '4px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
                borderRadius: 5, color: page === 1 ? C.textFaint : C.textMid, fontSize: 11,
                cursor: page === 1 ? 'default' : 'pointer', fontFamily: font,
              }}>Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{
                padding: '4px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
                borderRadius: 5, color: page === totalPages ? C.textFaint : C.textMid, fontSize: 11,
                cursor: page === totalPages ? 'default' : 'pointer', fontFamily: font,
              }}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
