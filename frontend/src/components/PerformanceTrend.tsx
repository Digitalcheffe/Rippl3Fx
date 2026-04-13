import { useState } from 'react';
import { C } from '../theme';

const font = "'DM Mono', monospace";

function getDateLabels(days: number = 7): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (i === 0) { labels.push('Today'); }
    else { labels.push(`${d.getMonth() + 1}/${d.getDate()}`); }
  }
  return labels;
}
const DAY_LABELS = getDateLabels(7);

interface PerformanceTrendItem {
  interestHistory: number[];
}

export default function PerformanceTrend({ items, platform, width = 500, height = 100, onClose }: { items: PerformanceTrendItem[]; platform?: string; width?: number; height?: number; onClose?: () => void }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Average performance across all items per day
  const avgPerf = DAY_LABELS.map((_, di) => {
    const vals = items.map(i => i.interestHistory?.[di] ?? 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  // Fixed 0-100% scale
  const padL = 36, padR = 12, padT = 8, padB = 20;
  const cW = width - padL - padR, cH = height - padT - padB;
  const toX = (i: number) => padL + (i / (DAY_LABELS.length - 1)) * cW;
  const toY = (v: number) => padT + cH - (v / 100) * cH;
  const pts = avgPerf.map((v, i) => [toX(i), toY(v)]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${toX(DAY_LABELS.length - 1)},${padT + cH} L${toX(0)},${padT + cH} Z`;

  const current = avgPerf[avgPerf.length - 1];
  const prev = avgPerf[avgPerf.length - 2];
  const trend = current > prev ? '↑' : current < prev ? '↓' : '—';
  const tColor = current > prev ? C.up : current < prev ? C.down : C.flat;

  // Tooltip positioning
  const slotW = cW / DAY_LABELS.length;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>Performance Trend</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font }}>{platform ? `${platform} momentum over time` : 'Cross-platform momentum over time'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: tColor, fontFamily: font, lineHeight: 1 }}>{trend}</div>
            <div style={{ fontSize: 11, color: C.textFaint, fontFamily: font, marginTop: 2 }}>vs yesterday</div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textFaint, fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      <svg width={width} height={height} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="perfgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Y-axis percentage grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = toY(pct);
          return (
            <g key={pct}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={padL - 4} y={y + 3} fontSize="9" fill={C.textFaint} textAnchor="end" fontFamily="monospace">{pct}%</text>
            </g>
          );
        })}

        <path d={area} fill="url(#perfgrad)" />
        <path d={line} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Data point circles */}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={hoverIdx === i ? 4 : (i === pts.length - 1 ? 3 : 0)} fill={C.accent} style={{ transition: 'r 0.15s' }} />
        ))}

        {/* Vertical hover line */}
        {hoverIdx !== null && (
          <line x1={pts[hoverIdx][0]} y1={padT} x2={pts[hoverIdx][0]} y2={padT + cH} stroke={C.accent} strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
        )}

        {/* Invisible hover zones */}
        {DAY_LABELS.map((_, i) => (
          <rect key={i} x={toX(i) - slotW / 2} y={0} width={slotW} height={height} fill="transparent"
            onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'crosshair' }} />
        ))}

        {/* Tooltip */}
        {hoverIdx !== null && (() => {
          const val = avgPerf[hoverIdx];
          const x = pts[hoverIdx][0];
          const y = pts[hoverIdx][1];
          const label = `${DAY_LABELS[hoverIdx]}: ${val.toFixed(1)}%`;
          const tipW = label.length * 6.5 + 12;
          const tipX = x + tipW + 8 > width ? x - tipW - 4 : x + 4;
          const tipY = Math.max(padT, y - 22);
          return (
            <g>
              <rect x={tipX} y={tipY} width={tipW} height={18} rx={4} fill={C.bgCard} stroke={C.accent} strokeWidth={0.5} opacity={0.95} />
              <text x={tipX + 6} y={tipY + 13} fontSize="9" fontWeight="700" fill={C.accent} fontFamily={font}>{label}</text>
            </g>
          );
        })()}

        {DAY_LABELS.map((l, i) => (
          <text key={l} x={toX(i)} y={height - 2} fontSize="9" fill={hoverIdx === i ? C.text : C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
        ))}
      </svg>

      <div style={{ marginTop: 8, fontSize: 10, color: C.textFaint, fontFamily: font }}>
        Reach 20% · Interest 30% · Engagement 50%
      </div>
    </div>
  );
}
