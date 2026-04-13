import { useRef, useState, useEffect } from 'react';
import { C } from '../theme';

const font = "'DM Mono', monospace";

function getLabels(range: string = 'daily', count: number = 7): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (range === 'weekly') {
      d.setDate(d.getDate() - i * 7);
      const mon = new Date(d);
      const day = mon.getDay();
      mon.setDate(mon.getDate() - (day === 0 ? 6 : day - 1));
      labels.push(i === 0 ? 'This Week' : `${mon.getMonth() + 1}/${mon.getDate()}`);
    } else if (range === 'monthly') {
      d.setMonth(d.getMonth() - i);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      labels.push(i === 0 ? 'This Month' : months[d.getMonth()]);
    } else {
      d.setDate(d.getDate() - i);
      labels.push(i === 0 ? 'Today' : `${d.getMonth() + 1}/${d.getDate()}`);
    }
  }
  return labels;
}

const PLATFORM_ORDER = ['github', 'ga4', 'bing'];
const PLATFORM_DISPLAY: Record<string, string> = { github: 'GitHub', ga4: 'GA4', bing: 'Bing' };

const LANE_HISTORY_KEY: Record<string, string> = {
  Reach: 'reachHistory',
  Interest: 'interestHistory',
  Engagement: 'engagementHistory',
};

export interface LaneChartItem {
  platform: string;
  reachHistory?: number[];
  interestHistory: number[];
  engagementHistory?: number[];
}

function LayeredChartSVG({ items, width, height, lane, range = 'daily' }: { items: LaneChartItem[]; width: number; height: number; lane: string; range?: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const labels = getLabels(range);
  const padL = 36, padR = 12, padT = 12, padB = 24;
  const cW = width - padL - padR;
  const cH = height - padT - padB;

  const histKey = LANE_HISTORY_KEY[lane] || 'interestHistory';

  // Group items by platform, sum their lane histories
  const platformData: Record<string, number[]> = {};
  for (const item of items) {
    const key = item.platform;
    if (!platformData[key]) platformData[key] = new Array(7).fill(0);
    const hist = (item as any)[histKey] || item.interestHistory || [];
    for (let i = 0; i < 7; i++) {
      platformData[key][i] += hist[i] ?? 0;
    }
  }

  const activePlatforms = PLATFORM_ORDER.filter(p => platformData[p]);
  const allValues = Object.values(platformData).flat();
  const maxVal = Math.max(...allValues, 1);

  const toX = (i: number) => padL + (i / 6) * cW;
  const toY = (v: number) => padT + cH - (v / maxVal) * cH;

  const laneColor = (C[lane as keyof typeof C] || C.accent) as string;
  const slotW = cW / labels.length;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Grid lines */}
      {[25, 50, 75, 100].map(pct => {
        const y = toY((pct / 100) * maxVal);
        return (
          <g key={pct}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={padL - 4} y={y + 3} fontSize="9" fill={C.textFaint} textAnchor="end" fontFamily="monospace">{pct}</text>
          </g>
        );
      })}

      {/* Y axis label */}
      <text x={8} y={padT + cH / 2} fontSize="9" fill={laneColor} textAnchor="middle" fontFamily="monospace" transform={`rotate(-90, 8, ${padT + cH / 2})`}>{lane}</text>

      {/* X axis labels */}
      {labels.map((l, i) => (
        <text key={l} x={toX(i)} y={height - 4} fontSize="9" fill={hoverIdx === i ? C.text : C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
      ))}

      {/* Platform areas + lines */}
      {activePlatforms.map(platform => {
        const data = platformData[platform];
        const displayKey = PLATFORM_DISPLAY[platform] || platform;
        const color = (C[displayKey as keyof typeof C] || C.accent) as string;
        const pts = data.map((v, i) => [toX(i), toY(v)]);
        const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const area = `${line} L${toX(6)},${padT + cH} L${toX(0)},${padT + cH} Z`;

        return (
          <g key={platform}>
            <path d={area} fill={color} opacity={0.15} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} opacity={0.8} strokeLinejoin="round" strokeLinecap="round" />
            {/* Show all dots on hover, otherwise just last */}
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={hoverIdx === i ? 4 : (i === pts.length - 1 ? 3 : 0)} fill={color} style={{ transition: 'r 0.15s' }} />
            ))}
          </g>
        );
      })}

      {/* Vertical hover line */}
      {hoverIdx !== null && (
        <line x1={toX(hoverIdx)} y1={padT} x2={toX(hoverIdx)} y2={padT + cH} stroke={laneColor} strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
      )}

      {/* Invisible hover zones */}
      {labels.map((_, i) => (
        <rect key={i} x={toX(i) - slotW / 2} y={0} width={slotW} height={height} fill="transparent"
          onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'crosshair' }} />
      ))}

      {/* Tooltip — show all platform values at hovered date */}
      {hoverIdx !== null && (() => {
        const x = toX(hoverIdx);
        const lines = activePlatforms.map(p => ({
          name: PLATFORM_DISPLAY[p] || p,
          value: platformData[p][hoverIdx] ?? 0,
          color: (C[(PLATFORM_DISPLAY[p] || p) as keyof typeof C] || C.accent) as string,
        }));
        const tipW = 120;
        const tipH = 14 + lines.length * 14;
        const tipX = x + tipW + 8 > width ? x - tipW - 4 : x + 8;
        const tipY = Math.max(padT, padT + 4);
        return (
          <g>
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6} fill={C.bgCard} stroke={C.border} strokeWidth={0.5} opacity={0.95} />
            <text x={tipX + 8} y={tipY + 12} fontSize="9" fontWeight="700" fill={C.text} fontFamily={font}>{labels[hoverIdx]}</text>
            {lines.map((l, li) => (
              <g key={l.name}>
                <circle cx={tipX + 10} cy={tipY + 24 + li * 14} r={3} fill={l.color} />
                <text x={tipX + 18} y={tipY + 27 + li * 14} fontSize="9" fill={C.textSoft} fontFamily={font}>{l.name}</text>
                <text x={tipX + tipW - 8} y={tipY + 27 + li * 14} fontSize="9" fontWeight="700" fill={C.text} fontFamily={font} textAnchor="end">{l.value.toFixed(1)}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

export default function LayeredInterestChart({ items, lane = 'Interest', tag, onClose, range = 'daily' }: { items: LaneChartItem[]; lane?: string; tag?: string; onClose?: () => void; range?: string }) {
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
  const laneColor = (C[lane as keyof typeof C] || C.accent) as string;

  return (
    <div ref={containerRef} style={{ background: C.bgCard, border: `1px solid ${laneColor}30`, borderTop: `3px solid ${laneColor}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: laneColor, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>{lane} Trend</div>
          {tag && <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font }}>#{tag}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {platforms.map(p => {
            const displayKey = PLATFORM_DISPLAY[p] || p;
            const color = (C[displayKey as keyof typeof C] || C.accent) as string;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2, background: color, borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: C.textFaint, fontFamily: font }}>{displayKey}</span>
              </div>
            );
          })}
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textFaint, fontSize: 16, cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      <LayeredChartSVG items={items} width={width - 40} height={120} lane={lane} range={range} />
    </div>
  );
}
