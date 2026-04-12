import { C } from '../theme';

const font = "'DM Mono', monospace";

const LANES = ['Reach', 'Interest', 'Engagement'] as const;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function velColor(v: number): string { return v > 0 ? C.up : v < 0 ? C.down : C.flat; }
function velSign(v: number): string { return v > 0 ? '+' : ''; }
function velArrow(v: number): string { return v > 0 ? '↑' : v < 0 ? '↓' : '—'; }

interface LaneData {
  current: number;
  velocity: number;
}

interface LaneSummaryItem {
  lanes: Record<string, { current: number; velocity: number }>;
}

export default function LaneSummary({ items }: { items: LaneSummaryItem[] }) {
  const totals: Record<string, LaneData> = {};
  for (const lane of LANES) {
    totals[lane] = {
      current: items.reduce((s, i) => s + (i.lanes[lane]?.current || 0), 0),
      velocity: items.reduce((s, i) => s + (i.lanes[lane]?.velocity || 0), 0),
    };
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {LANES.map(lane => {
        const d = totals[lane];
        const vc = velColor(d.velocity);
        const laneColor = C[lane as keyof typeof C] as string;
        return (
          <div key={lane} style={{
            flex: 1, minWidth: 160,
            background: C.bgCard, border: `1px solid ${laneColor}30`,
            borderTop: `3px solid ${laneColor}`, borderRadius: 10,
            padding: '12px 16px', boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: laneColor, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>{lane}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: C.text, fontFamily: font, letterSpacing: -0.5, lineHeight: 1 }}>{fmt(d.current)}</div>
            <div style={{ fontSize: 11, color: vc, fontWeight: 700, fontFamily: font, marginTop: 4 }}>
              {velArrow(d.velocity)} {velSign(d.velocity)}{fmt(Math.abs(d.velocity))} today
            </div>
          </div>
        );
      })}
    </div>
  );
}
