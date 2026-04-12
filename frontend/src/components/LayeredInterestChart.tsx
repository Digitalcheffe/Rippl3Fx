import { useRef, useState, useEffect } from 'react';
import { C } from '../theme';

const font = "'DM Mono', monospace";
const DAY_LABELS = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'];

const PLATFORM_ORDER = ['Reddit', 'GitHub', 'GA4', 'Bing'];

interface ChartItem {
  platform: string;
  interestHistory: number[];
}

function LayeredInterestChartSVG({ items, width, height }: { items: ChartItem[]; width: number; height: number }) {
  const padL = 36, padR = 12, padT = 12, padB = 24;
  const cW = width - padL - padR;
  const cH = height - padT - padB;

  // Group items by platform, average their interest histories
  const platformData: Record<string, number[]> = {};
  for (const item of items) {
    const key = item.platform;
    if (!platformData[key]) platformData[key] = new Array(7).fill(0);
    for (let i = 0; i < 7; i++) {
      platformData[key][i] += item.interestHistory?.[i] ?? 0;
    }
  }

  const allValues = Object.values(platformData).flat();
  const maxVal = Math.max(...allValues, 1);

  const toX = (i: number) => padL + (i / 6) * cW;
  const toY = (v: number) => padT + cH - (v / maxVal) * cH;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Grid lines */}
      {[25, 50, 75, 100].map(pct => {
        const y = toY((pct / 100) * maxVal);
        return (
          <g key={pct}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={padL - 4} y={y + 3} fontSize="8" fill={C.textFaint} textAnchor="end" fontFamily="monospace">{pct}</text>
          </g>
        );
      })}

      {/* Y axis label */}
      <text x={8} y={padT + cH / 2} fontSize="8" fill={C.textFaint} textAnchor="middle" fontFamily="monospace" transform={`rotate(-90, 8, ${padT + cH / 2})`}>Interest</text>

      {/* X axis labels */}
      {DAY_LABELS.map((l, i) => (
        <text key={l} x={toX(i)} y={height - 4} fontSize="8" fill={C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
      ))}

      {/* Platform areas + lines */}
      {PLATFORM_ORDER.filter(p => platformData[p]).map(platform => {
        const data = platformData[platform];
        const color = (C[platform as keyof typeof C] || C.accent) as string;
        const pts = data.map((v, i) => [toX(i), toY(v)]);
        const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const area = `${line} L${toX(6)},${padT + cH} L${toX(0)},${padT + cH} Z`;

        return (
          <g key={platform}>
            <path d={area} fill={color} opacity={0.15} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} opacity={0.8} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

export default function LayeredInterestChart({ items, tag }: { items: ChartItem[]; tag?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) return null;

  const platforms = [...new Set(items.map(i => i.platform))];

  return (
    <div ref={containerRef} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>Combined Interest</div>
          {tag && <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font }}>#{tag}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {platforms.map(p => {
            const color = (C[p as keyof typeof C] || C.accent) as string;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
                <span style={{ fontSize: 9, color: C.textFaint, fontFamily: font }}>{p}</span>
              </div>
            );
          })}
        </div>
      </div>

      <LayeredInterestChartSVG items={items} width={width - 40} height={120} />

      <div style={{ marginTop: 8, fontSize: 10, color: C.textFaint, fontFamily: font, fontStyle: 'italic' }}>
        Interest scores use placeholder weights — adjust in Settings
      </div>
    </div>
  );
}
