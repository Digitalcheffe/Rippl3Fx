import { C } from '../theme';
import PlatformPill from './PlatformPill';
import Sparkline from './Sparkline';

const font = "'DM Mono', monospace";

const LANES = ['Reach', 'Interest', 'Engagement'] as const;

// Format large numbers
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function velColor(v: number): string {
  return v > 0 ? C.up : v < 0 ? C.down : C.flat;
}
function velSign(v: number): string {
  return v > 0 ? '+' : '';
}
function velArrow(v: number): string {
  return v > 0 ? '↑' : v < 0 ? '↓' : '—';
}

interface LaneData {
  current: number;
  history: number[];
  velocity: number;
}

export interface StatCardItem {
  id: number;
  platform: string;
  display_name: string;
  tags: string[];
  lanes: Record<string, LaneData>;
  performanceScore?: number;
  distribution?: { reach: number; interest: number; engagement: number };
  peaks?: { reach_peak: number; interest_peak: number; engagement_peak: number } | null;
}

interface LaneRowProps {
  lane: string;
  data: LaneData;
  compact?: boolean;
  distPct?: number;
  peak?: number;
}

function LaneRow({ lane, data, compact = false, distPct, peak }: LaneRowProps) {
  const color = C[lane as keyof typeof C] as string;
  const vc = velColor(data.velocity);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: compact ? 60 : 72, flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1, fontFamily: font }}>{lane}</div>
        <div style={{ fontSize: compact ? 14 : 16, fontWeight: 900, color: C.text, fontFamily: font, lineHeight: 1.2, letterSpacing: -0.5 }}>{fmt(data.current)}</div>
        {peak != null && peak > 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textFaint, fontFamily: font }}>/ {fmt(peak)}</div>
        )}
      </div>
      <Sparkline data={data.history} color={color} width={compact ? 64 : 76} height={22} />
      {data.velocity !== 0 && (
        <div style={{ fontSize: 10, color: vc, fontWeight: 700, fontFamily: font, minWidth: 36, textAlign: 'right' }}>
          {velArrow(data.velocity)} {velSign(data.velocity)}{fmt(Math.abs(data.velocity))}
        </div>
      )}
      {distPct != null && (
        <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, minWidth: 36, textAlign: 'right' }}>
          {distPct.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export default function StatCard({ item, index = 0, onClick }: { item: StatCardItem; index?: number; onClick?: () => void }) {
  const color = (C[item.platform as keyof typeof C] || C.accent) as string;

  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 12,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 2px 8px rgba(30,58,95,0.07)',
        animation: 'fadeUp 0.4s ease both',
        animationDelay: `${index * 0.06}s`,
        transition: 'box-shadow 0.2s, transform 0.2s, background 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(30,58,95,0.13), 0 0 0 1px ${color}25`;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.background = C.bgCardHover;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(30,58,95,0.07)';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.background = C.bgCard;
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 7 }}><PlatformPill platform={item.platform} /></div>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, lineHeight: 1.4, fontFamily: font }}>{item.display_name}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', paddingTop: 2 }}>
          {item.tags.map(t => (
            <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}30`, fontFamily: font }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: C.border }} />

      {/* Three lanes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LANES.map(lane => {
          const data = item.lanes[lane];
          if (!data) return null;
          const dist = item.distribution;
          const pct = dist ? dist[lane.toLowerCase() as keyof typeof dist] : undefined;
          const peakKey = `${lane.toLowerCase()}_peak` as string;
          const peakVal = item.peaks ? (item.peaks as any)[peakKey] : undefined;
          return <LaneRow key={lane} lane={lane} data={data} distPct={pct} peak={peakVal} />;
        })}
      </div>

      {/* Performance score removed — v0.2.0 will replace with Ripple Index */}
    </div>
  );
}
