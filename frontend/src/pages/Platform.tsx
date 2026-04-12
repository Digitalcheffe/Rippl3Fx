import { useParams } from 'react-router-dom';
import { C } from '../theme';

const font = "'DM Mono', monospace";

const PLATFORM_NAMES: Record<string, string> = {
  reddit: 'Reddit',
  github: 'GitHub',
  ga4: 'GA4',
  bing: 'Bing',
};

export default function Platform() {
  const { platform } = useParams<{ platform: string }>();
  const name = PLATFORM_NAMES[platform || ''] || platform || 'Unknown';

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Platform</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>{name}</h1>
      <div style={{ marginTop: 40, textAlign: 'center', color: C.textSoft, fontSize: 13, fontFamily: font }}>
        Connect your {name} account in Settings to start tracking.
      </div>
    </div>
  );
}
