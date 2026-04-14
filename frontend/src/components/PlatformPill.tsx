import { C } from '../theme';

const font = "'DM Mono', monospace";

const PLATFORM_ICONS: Record<string, string> = { GitHub: 'G', GA4: 'A', Bing: 'B' };

export default function PlatformPill({ platform }: { platform: string }) {
  const color = C[platform as keyof typeof C] || C.accent;
  const icon = PLATFORM_ICONS[platform] || platform[0];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 15, height: 15, borderRadius: '50%',
        background: color as string, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 900, color: '#fff', fontFamily: 'monospace',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, color: color as string,
        letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: font,
      }}>
        {platform}
      </span>
    </div>
  );
}
