import { C } from '../theme';
import { LaneTooltip } from './LaneInfo';

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

interface Props {
  items: LaneSummaryItem[];
  performanceScore?: number;
  performanceVelocity?: number;
  weights?: { reach: number; interest: number; engagement: number };
  activeCard?: string | null;
  onCardClick?: (lane: string) => void;
  timeLabel?: string;
  platform?: string;
  peaks?: { reach_peak: number; interest_peak: number; engagement_peak: number } | null;
}

export default function LaneSummary({ items, performanceScore, performanceVelocity, weights, activeCard, onCardClick, timeLabel = 'today', platform, peaks }: Props) {
  const totals: Record<string, LaneData> = {};
  for (const lane of LANES) {
    totals[lane] = {
      current: items.reduce((s, i) => s + (i.lanes[lane]?.current || 0), 0),
      velocity: items.reduce((s, i) => s + (i.lanes[lane]?.velocity || 0), 0),
    };
  }

  const pv = performanceVelocity ?? 0;

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      {LANES.map(lane => {
        const d = totals[lane];
        const vc = velColor(d.velocity);
        const laneColor = C[lane as keyof typeof C] as string;
        const isActive = activeCard === lane;
        return (
          <div key={lane} onClick={() => onCardClick?.(lane)} style={{
            flex: 1, minWidth: 140,
            background: isActive ? laneColor + '08' : C.bgCard,
            borderLeft: `1px solid ${isActive ? laneColor + '60' : laneColor + '30'}`,
            borderRight: `1px solid ${isActive ? laneColor + '60' : laneColor + '30'}`,
            borderBottom: `1px solid ${isActive ? laneColor + '60' : laneColor + '30'}`,
            borderTop: `3px solid ${laneColor}`, borderRadius: 10,
            padding: '12px 16px', boxShadow: isActive ? `0 4px 16px ${laneColor}20` : '0 2px 8px rgba(30,58,95,0.06)',
            cursor: onCardClick ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 12, letterSpacing: 2, color: laneColor, textTransform: 'uppercase', fontWeight: 700, fontFamily: font }}>{lane}<LaneTooltip lane={lane} platform={platform} /></div>
              {peaks && (() => {
                const peakKey = `${lane.toLowerCase()}_peak` as keyof typeof peaks;
                const peakVal = peaks[peakKey] as number;
                return peakVal > 0 ? (
                  <div style={{ fontSize: 12, color: C.textMid, fontFamily: font }}>Peak: {fmt(peakVal)}</div>
                ) : null;
              })()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: 12, color: C.textMid, fontFamily: font, textTransform: 'capitalize' }}>{timeLabel}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: font, letterSpacing: -0.5, lineHeight: 1 }}>{fmt(d.current)}</div>
              </div>
              {d.velocity !== 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 12, color: C.textMid, fontFamily: font }}>Change</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: vc, fontFamily: font, lineHeight: 1 }}>
                      {velSign(d.velocity)}{fmt(Math.abs(d.velocity))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 12, color: C.textMid, fontFamily: font }}>% Change</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: vc, fontFamily: font, lineHeight: 1 }}>
                      {(() => { const prev = d.current - d.velocity; return prev !== 0 ? `${d.velocity > 0 ? '+' : ''}${((d.velocity / prev) * 100).toFixed(1)}%` : 'new'; })()}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font }}>change</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.textFaint, fontFamily: font, lineHeight: 1 }}>--</div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {performanceScore != null && (() => {
        const isActive = activeCard === 'Performance';
        return (
        <div onClick={() => onCardClick?.('Performance')} style={{
          flex: 1, minWidth: 140,
          background: isActive ? C.accent + '08' : C.bgCard,
          borderLeft: `1px solid ${isActive ? C.accent + '60' : C.accent + '30'}`,
          borderRight: `1px solid ${isActive ? C.accent + '60' : C.accent + '30'}`,
          borderBottom: `1px solid ${isActive ? C.accent + '60' : C.accent + '30'}`,
          borderTop: `3px solid ${C.accent}`, borderRadius: 10,
          padding: '12px 16px', boxShadow: isActive ? `0 4px 16px ${C.accent}20` : '0 2px 8px rgba(30,58,95,0.06)',
          cursor: onCardClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>Performance<LaneTooltip lane="Performance" platform={platform} /></div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.text, fontFamily: font, letterSpacing: -0.5, lineHeight: 1 }}>{performanceScore.toFixed(1)}%</div>
          <div style={{ fontSize: 11, color: velColor(pv), fontWeight: 700, fontFamily: font, marginTop: 4 }}>
            {pv !== 0 ? `${velArrow(pv)} ${velSign(pv)}${Math.abs(pv).toFixed(1)} ${timeLabel}` : 'No change yet'}
          </div>
          {weights && (
            <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, marginTop: 4 }}>
              R {Math.round(weights.reach * 100)}% · I {Math.round(weights.interest * 100)}% · E {Math.round(weights.engagement * 100)}%
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
