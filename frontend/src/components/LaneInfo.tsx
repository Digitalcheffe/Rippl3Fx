import { useState } from 'react';
import { C } from '../theme';

const font = "'DM Mono', monospace";

export const LANE_DEFINITIONS: Record<string, Record<string, { metrics: string; description: string }>> = {
  github: {
    Reach: { metrics: 'Traffic Views', description: 'How many people saw your repo pages (requires push access)' },
    Interest: { metrics: 'Stars + Watchers', description: 'How many people starred or subscribed to your project' },
    Engagement: { metrics: 'Forks + Clones + Release Downloads', description: 'How many people forked, cloned, or downloaded releases' },
    Performance: { metrics: 'Weighted sum of lanes', description: '(Reach × R%) + (Interest × I%) + (Engagement × E%)' },
  },
  ga4: {
    Reach: { metrics: 'Pageviews', description: 'Total page views across tracked pages' },
    Interest: { metrics: 'Users', description: 'Unique users who visited' },
    Engagement: { metrics: 'Sessions', description: 'Total active sessions' },
    Performance: { metrics: 'Weighted sum of lanes', description: '(Reach × R%) + (Interest × I%) + (Engagement × E%)' },
  },
  bing: {
    Reach: { metrics: 'Impressions', description: 'How often your pages appeared in search results' },
    Interest: { metrics: 'Clicks', description: 'How many people clicked through from search' },
    Engagement: { metrics: 'CTR × 100', description: 'Click-through rate as a percentage' },
    Performance: { metrics: 'Weighted sum of lanes', description: '(Reach × R%) + (Interest × I%) + (Engagement × E%)' },
  },
  all: {
    Reach: { metrics: 'Combined across platforms', description: 'GitHub traffic views + GA4 pageviews + Bing impressions' },
    Interest: { metrics: 'Combined across platforms', description: 'GitHub stars/watchers + GA4 users + Bing clicks' },
    Engagement: { metrics: 'Combined across platforms', description: 'GitHub forks/clones/downloads + GA4 sessions + Bing CTR' },
    Performance: { metrics: 'Weighted sum of lanes', description: '(Reach × R%) + (Interest × I%) + (Engagement × E%)' },
  },
};

/** Small ? tooltip for a single lane card. */
export function LaneTooltip({ lane, platform }: { lane: string; platform?: string }) {
  const [show, setShow] = useState(false);
  const key = platform?.toLowerCase() || 'all';
  const info = LANE_DEFINITIONS[key]?.[lane] || LANE_DEFINITIONS.all[lane];
  if (!info) return null;

  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ fontSize: 11, color: C.textFaint, cursor: 'help', opacity: 0.8 }}
      >?</span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          background: C.bgNav, border: `1px solid ${C.borderMid}`, borderRadius: 8,
          padding: '8px 12px', width: 200, zIndex: 50, marginBottom: 4,
          boxShadow: '0 4px 16px rgba(13,31,53,0.3)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.text, fontFamily: font, marginBottom: 3 }}>{info.metrics}</div>
          <div style={{ fontSize: 10, color: C.textSoft, fontFamily: font, lineHeight: 1.4 }}>{info.description}</div>
        </div>
      )}
    </span>
  );
}

/** Full info panel toggled by an icon. */
export function LaneInfoPanel({ platform, onClose }: { platform?: string; onClose: () => void }) {
  const platforms = platform ? [platform.toLowerCase()] : ['github', 'ga4', 'bing'];
  const PLATFORM_DISPLAY: Record<string, string> = { github: 'GitHub', ga4: 'GA4', bing: 'Bing' };

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(30,58,95,0.07)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: font }}>Lane Definitions</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textFaint, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      {platforms.map(p => {
        const defs = LANE_DEFINITIONS[p];
        if (!defs) return null;
        return (
          <div key={p} style={{ marginBottom: platforms.length > 1 ? 14 : 0 }}>
            {platforms.length > 1 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: (C[(PLATFORM_DISPLAY[p] || p) as keyof typeof C] || C.accent) as string, fontFamily: font, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                {PLATFORM_DISPLAY[p] || p}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {['Reach', 'Interest', 'Engagement', 'Performance'].map(lane => {
                const info = defs[lane];
                if (!info) return null;
                const laneColor = lane === 'Performance' ? C.accent : (C[lane as keyof typeof C] || C.textMid) as string;
                return (
                  <div key={lane} style={{ padding: '6px 8px', background: C.bg, borderRadius: 6, borderTop: `2px solid ${laneColor}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: laneColor, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{lane}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: C.text, fontFamily: font, marginBottom: 2 }}>{info.metrics}</div>
                    <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, lineHeight: 1.3 }}>{info.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Info icon button that toggles the panel. */
export function LaneInfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
      color: C.textFaint, fontSize: 11, cursor: 'pointer', fontFamily: font,
      padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>i</span>
      <span>Info</span>
    </button>
  );
}
