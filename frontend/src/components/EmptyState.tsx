import { useNavigate } from 'react-router-dom';
import { C } from '../theme';

const font = "'DM Mono', monospace";
const PLATFORM_ICONS: Record<string, string> = { GitHub: 'G', GA4: 'A', Bing: 'B' };

export default function EmptyState({ platform }: { platform: string }) {
  const navigate = useNavigate();
  const color = (C[platform as keyof typeof C] || C.accent) as string;
  const icon = PLATFORM_ICONS[platform] || platform[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 40px', gap: 14, textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: color + '15', border: `2px dashed ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 20, fontWeight: 900, color, fontFamily: 'monospace' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: font }}>No {platform} account connected</div>
      <div style={{ fontSize: 12, color: C.textSoft, maxWidth: 280, lineHeight: 1.7, fontFamily: font }}>
        Connect your account to start tracking. Browse your content and tag items to begin long-term polling.
      </div>
      <button
        onClick={() => navigate('/settings?tab=accounts')}
        style={{ marginTop: 6, padding: '9px 22px', borderRadius: 8, background: color, color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: font }}
      >
        Connect {platform}
      </button>
    </div>
  );
}
