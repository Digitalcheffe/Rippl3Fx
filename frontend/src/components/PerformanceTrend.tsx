import { C } from '../theme';

const font = "'DM Mono', monospace";
const DAY_LABELS = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];

interface PerformanceTrendItem {
  interestHistory: number[];
}

export default function PerformanceTrend({ items, platform, width = 500, height = 80 }: { items: PerformanceTrendItem[]; platform?: string; width?: number; height?: number }) {
  // Average performance across all items per day
  const avgPerf = DAY_LABELS.map((_, di) => {
    const vals = items.map(i => i.interestHistory?.[di] ?? 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  const max = Math.max(...avgPerf, 1);
  const min = Math.min(...avgPerf);
  const range = max - min || 1;
  const padL = 28, padR = 12, padT = 8, padB = 20;
  const cW = width - padL - padR, cH = height - padT - padB;
  const toX = (i: number) => padL + (i / (DAY_LABELS.length - 1)) * cW;
  const toY = (v: number) => padT + cH - ((v - min) / range) * cH;
  const pts = avgPerf.map((v, i) => [toX(i), toY(v)]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${toX(DAY_LABELS.length - 1)},${padT + cH} L${toX(0)},${padT + cH} Z`;

  const current = avgPerf[avgPerf.length - 1];
  const prev = avgPerf[avgPerf.length - 2];
  const trend = current > prev ? '↑' : current < prev ? '↓' : '—';
  const tColor = current > prev ? C.up : current < prev ? C.down : C.flat;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>Performance Trend</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font }}>{platform ? `${platform} momentum over time` : 'Cross-platform momentum over time'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: tColor, fontFamily: font, lineHeight: 1 }}>{trend}</div>
          <div style={{ fontSize: 11, color: C.textFaint, fontFamily: font, marginTop: 2 }}>vs yesterday</div>
        </div>
      </div>

      <svg width={width} height={height} style={{ display: 'block', width: '100%' }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="perfgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#perfgrad)" />
        <path d={line} fill="none" stroke={C.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={C.accent} />
        {DAY_LABELS.map((l, i) => (
          <text key={l} x={toX(i)} y={height - 2} fontSize="8" fill={C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
        ))}
      </svg>

      <div style={{ marginTop: 8, fontSize: 10, color: C.textFaint, fontFamily: font }}>
        Reach 20% · Interest 30% · Engagement 50%
      </div>
    </div>
  );
}
