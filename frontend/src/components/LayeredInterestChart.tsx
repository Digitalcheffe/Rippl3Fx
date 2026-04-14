import { useRef, useState, useEffect } from 'react';
import { C } from '../theme';

const font = "'DM Mono', monospace";

export interface ChartEvent {
  id: number;
  name: string;
  event_date: string;
}

/** Map an event date to an array index for the given range, or -1 if out of range. */
function eventToIndex(eventDate: string, range: string, dataLen: number): number {
  const now = new Date();
  const ed = new Date(eventDate + (eventDate.includes('T') ? '' : 'T12:00:00'));

  if (range === 'hourly') {
    const diffMs = now.getTime() - ed.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const idx = (dataLen - 1) - diffHours;
    return idx >= 0 && idx < dataLen ? idx : -1;
  } else if (range === 'weekly') {
    // Find current week start (Monday)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayDay = today.getDay();
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - (todayDay === 0 ? 6 : todayDay - 1));

    const eventDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
    const eventDayOfWeek = eventDay.getDay();
    const eventWeekStart = new Date(eventDay);
    eventWeekStart.setDate(eventDay.getDate() - (eventDayOfWeek === 0 ? 6 : eventDayOfWeek - 1));

    const diffWeeks = Math.round((thisWeekStart.getTime() - eventWeekStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const idx = (dataLen - 1) - diffWeeks;
    return idx >= 0 && idx < dataLen ? idx : -1;
  } else if (range === 'monthly') {
    const diffMonths = (now.getFullYear() - ed.getFullYear()) * 12 + (now.getMonth() - ed.getMonth());
    const idx = (dataLen - 1) - diffMonths;
    return idx >= 0 && idx < dataLen ? idx : -1;
  } else {
    // daily
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
    const diffDays = Math.round((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));
    const idx = (dataLen - 1) - diffDays;
    return idx >= 0 && idx < dataLen ? idx : -1;
  }
}

function getLabels(range: string = 'daily', count: number = 7): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (range === 'hourly') {
      d.setHours(d.getHours() - i);
      labels.push(i === 0 ? 'Now' : `${d.getHours()}:00`);
    } else if (range === 'weekly') {
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

function LayeredChartSVG({ items, width, height, lane, range = 'daily', useLaneColor = false, events = [] }: { items: LaneChartItem[]; width: number; height: number; lane: string; range?: string; useLaneColor?: boolean; events?: ChartEvent[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dataLen = range === 'hourly' ? 24 : 7;
  const labels = getLabels(range, dataLen);
  const padL = 52, padR = 12, padT = 22, padB = 24;
  const cW = width - padL - padR;
  const cH = height - padT - padB;

  const histKey = LANE_HISTORY_KEY[lane] || 'interestHistory';
  const laneColor = (C[lane as keyof typeof C] || C.accent) as string;

  // Group items by platform, sum their lane histories
  const platformData: Record<string, number[]> = {};
  for (const item of items) {
    const key = item.platform;
    if (!platformData[key]) platformData[key] = new Array(dataLen).fill(0);
    const hist = (item as any)[histKey] || item.interestHistory || [];
    for (let i = 0; i < dataLen; i++) {
      platformData[key][i] += hist[i] ?? 0;
    }
  }

  const activePlatforms = PLATFORM_ORDER.filter(p => platformData[p]);
  const allValues = Object.values(platformData).flat();
  const maxVal = Math.max(...allValues, 1);

  const maxIdx = dataLen - 1;
  const toX = (i: number) => padL + (i / maxIdx) * cW;
  const toY = (v: number) => padT + cH - (v / maxVal) * cH;
  const slotW = cW / labels.length;

  // For hourly (24 points), only show every 4th label to avoid crowding
  const showLabel = (i: number) => range !== 'hourly' || i % 4 === 0 || i === maxIdx;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Grid lines */}
      {[25, 50, 75, 100].map(pct => {
        const y = toY((pct / 100) * maxVal);
        return (
          <g key={pct}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={padL - 4} y={y + 3} fontSize="9" fill={C.textFaint} textAnchor="end" fontFamily="monospace">{Math.round((pct / 100) * maxVal)}</text>
          </g>
        );
      })}

      {/* Y axis label */}
      <text x={8} y={padT + cH / 2} fontSize="9" fill={laneColor} textAnchor="middle" fontFamily="monospace" transform={`rotate(-90, 8, ${padT + cH / 2})`}>{lane}</text>

      {/* X axis labels */}
      {labels.map((l, i) => showLabel(i) ? (
        <text key={i} x={toX(i)} y={height - 4} fontSize="9" fill={hoverIdx === i ? C.text : C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
      ) : null)}

      {/* Event markers */}
      {events.map(ev => {
        const idx = eventToIndex(ev.event_date, range, dataLen);
        if (idx < 0) return null;
        const x = toX(idx);
        const label = ev.name.length > 14 ? ev.name.slice(0, 13) + '…' : ev.name;
        return (
          <g key={`ev-${ev.id}`}>
            <line x1={x} y1={padT} x2={x} y2={padT + cH} stroke={C.accent} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
            <circle cx={x} cy={padT - 2} r={3} fill={C.accent} />
            <text x={x + 5} y={padT - 4} fontSize="8" fill={C.accent} fontFamily={font} fontWeight="700">{label}</text>
          </g>
        );
      })}

      {/* Platform areas + lines */}
      {activePlatforms.map(platform => {
        const data = platformData[platform];
        const displayKey = PLATFORM_DISPLAY[platform] || platform;
        const color = useLaneColor ? laneColor : (C[displayKey as keyof typeof C] || C.accent) as string;
        const pts = data.map((v, i) => [toX(i), toY(v)]);
        const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const area = `${line} L${toX(maxIdx)},${padT + cH} L${toX(0)},${padT + cH} Z`;

        return (
          <g key={platform}>
            <path d={area} fill={color} opacity={0.15} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} opacity={0.8} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={hoverIdx === i ? 5 : 2.5} fill={color} style={{ transition: 'r 0.15s' }} />
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
        const hoveredEvents = events.filter(ev => eventToIndex(ev.event_date, range, dataLen) === hoverIdx);
        const tipW = 150;
        const tipH = 20 + lines.length * 20 + (hoveredEvents.length > 0 ? 4 + hoveredEvents.length * 16 : 0);
        const tipX = x + tipW + 8 > width ? x - tipW - 4 : x + 8;
        const tipY = Math.max(padT, padT + 4);
        const evY = 20 + lines.length * 20;
        return (
          <g>
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6} fill={C.bgCard} stroke={C.border} strokeWidth={0.5} opacity={0.95} />
            <text x={tipX + 10} y={tipY + 16} fontSize="12" fontWeight="700" fill={C.text} fontFamily={font}>{labels[hoverIdx]}</text>
            {lines.map((l, li) => (
              <g key={l.name}>
                <circle cx={tipX + 12} cy={tipY + 32 + li * 20} r={4} fill={l.color} />
                <text x={tipX + 22} y={tipY + 36 + li * 20} fontSize="12" fill={C.textSoft} fontFamily={font}>{l.name}</text>
                <text x={tipX + tipW - 10} y={tipY + 36 + li * 20} fontSize="12" fontWeight="700" fill={C.text} fontFamily={font} textAnchor="end">{l.value.toFixed(0)}</text>
              </g>
            ))}
            {hoveredEvents.map((ev, ei) => (
              <g key={`ev-tip-${ev.id}`}>
                <circle cx={tipX + 12} cy={tipY + evY + 8 + ei * 16} r={3} fill={C.accent} />
                <text x={tipX + 22} y={tipY + evY + 12 + ei * 16} fontSize="10" fontWeight="600" fill={C.accent} fontFamily={font}>{ev.name.length > 16 ? ev.name.slice(0, 15) + '…' : ev.name}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

const LANE_COLORS: Record<string, string> = {
  Reach: C.Reach as string,
  Interest: C.Interest as string,
  Engagement: C.Engagement as string,
};

const ALL_LANES = ['Reach', 'Interest', 'Engagement'];

/** SVG chart showing all three lanes overlaid with their respective colors. */
function AllLanesChartSVG({ items, width, height, range = 'daily', events = [] }: { items: LaneChartItem[]; width: number; height: number; range?: string; events?: ChartEvent[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const dataLen = range === 'hourly' ? 24 : 7;
  const labels = getLabels(range, dataLen);
  const padL = 52, padR = 12, padT = 22, padB = 24;
  const cW = width - padL - padR;
  const cH = height - padT - padB;

  // Sum history per lane across all items
  const laneData: Record<string, number[]> = {};
  for (const lane of ALL_LANES) {
    laneData[lane] = new Array(dataLen).fill(0);
    const histKey = LANE_HISTORY_KEY[lane];
    for (const item of items) {
      const hist = (item as any)[histKey] || [];
      for (let i = 0; i < dataLen; i++) {
        laneData[lane][i] += hist[i] ?? 0;
      }
    }
  }

  const allValues = Object.values(laneData).flat();
  const maxVal = Math.max(...allValues, 1);

  const maxIdx = dataLen - 1;
  const toX = (i: number) => padL + (i / maxIdx) * cW;
  const toY = (v: number) => padT + cH - (v / maxVal) * cH;
  const slotW = cW / labels.length;

  // For hourly (24 points), only show every 4th label
  const showLabel = (i: number) => range !== 'hourly' || i % 4 === 0 || i === maxIdx;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Grid lines */}
      {[25, 50, 75, 100].map(pct => {
        const y = toY((pct / 100) * maxVal);
        return (
          <g key={pct}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={padL - 4} y={y + 3} fontSize="9" fill={C.textFaint} textAnchor="end" fontFamily="monospace">{Math.round((pct / 100) * maxVal)}</text>
          </g>
        );
      })}

      {/* X axis labels */}
      {labels.map((l, i) => showLabel(i) ? (
        <text key={i} x={toX(i)} y={height - 4} fontSize="9" fill={hoverIdx === i ? C.text : C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
      ) : null)}

      {/* Event markers */}
      {events.map(ev => {
        const idx = eventToIndex(ev.event_date, range, dataLen);
        if (idx < 0) return null;
        const x = toX(idx);
        const label = ev.name.length > 14 ? ev.name.slice(0, 13) + '…' : ev.name;
        return (
          <g key={`ev-${ev.id}`}>
            <line x1={x} y1={padT} x2={x} y2={padT + cH} stroke={C.accent} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
            <circle cx={x} cy={padT - 2} r={3} fill={C.accent} />
            <text x={x + 5} y={padT - 4} fontSize="8" fill={C.accent} fontFamily={font} fontWeight="700">{label}</text>
          </g>
        );
      })}

      {/* Lane areas + lines */}
      {ALL_LANES.map((lane, laneIdx) => {
        const data = laneData[lane];
        const color = LANE_COLORS[lane] || C.accent;
        const pts = data.map((v, i) => [toX(i), toY(v)]);
        const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const area = `${line} L${toX(maxIdx)},${padT + cH} L${toX(0)},${padT + cH} Z`;
        // Stagger labels above the line per lane to avoid overlap
        const labelYOffset = laneIdx === 0 ? -20 : laneIdx === 1 ? -14 : -8;

        return (
          <g key={lane}>
            <path d={area} fill={color} opacity={0.1} />
            <path d={line} fill="none" stroke={color} strokeWidth={2} opacity={0.8} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={hoverIdx === i ? 5 : 2.5} fill={color} style={{ transition: 'r 0.15s' }} />
            ))}
          </g>
        );
      })}

      {/* Vertical hover line */}
      {hoverIdx !== null && (
        <line x1={toX(hoverIdx)} y1={padT} x2={toX(hoverIdx)} y2={padT + cH} stroke={C.textMid} strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
      )}

      {/* Invisible hover zones */}
      {labels.map((_, i) => (
        <rect key={i} x={toX(i) - slotW / 2} y={0} width={slotW} height={height} fill="transparent"
          onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'crosshair' }} />
      ))}

      {/* Tooltip — show all lane values at hovered date */}
      {hoverIdx !== null && (() => {
        const x = toX(hoverIdx);
        const lines = ALL_LANES.map(lane => ({
          name: lane,
          value: laneData[lane][hoverIdx] ?? 0,
          color: LANE_COLORS[lane] || C.accent,
        }));
        const hoveredEvents = events.filter(ev => eventToIndex(ev.event_date, range, dataLen) === hoverIdx);
        const tipW = 150;
        const tipH = 20 + lines.length * 20 + (hoveredEvents.length > 0 ? 4 + hoveredEvents.length * 16 : 0);
        const tipX = x + tipW + 8 > width ? x - tipW - 4 : x + 8;
        const tipY = Math.max(padT, padT + 4);
        const evY = 20 + lines.length * 20;
        return (
          <g>
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={6} fill={C.bgCard} stroke={C.border} strokeWidth={0.5} opacity={0.95} />
            <text x={tipX + 10} y={tipY + 16} fontSize="12" fontWeight="700" fill={C.text} fontFamily={font}>{labels[hoverIdx]}</text>
            {lines.map((l, li) => (
              <g key={l.name}>
                <circle cx={tipX + 12} cy={tipY + 32 + li * 20} r={4} fill={l.color} />
                <text x={tipX + 22} y={tipY + 36 + li * 20} fontSize="12" fill={C.textSoft} fontFamily={font}>{l.name}</text>
                <text x={tipX + tipW - 10} y={tipY + 36 + li * 20} fontSize="12" fontWeight="700" fill={C.text} fontFamily={font} textAnchor="end">{l.value.toFixed(0)}</text>
              </g>
            ))}
            {hoveredEvents.map((ev, ei) => (
              <g key={`ev-tip-${ev.id}`}>
                <circle cx={tipX + 12} cy={tipY + evY + 8 + ei * 16} r={3} fill={C.accent} />
                <text x={tipX + 22} y={tipY + evY + 12 + ei * 16} fontSize="10" fontWeight="600" fill={C.accent} fontFamily={font}>{ev.name.length > 16 ? ev.name.slice(0, 15) + '…' : ev.name}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

export default function LayeredInterestChart({ items, lane = 'Interest', tag, onClose, range = 'daily', events = [] }: { items: LaneChartItem[]; lane?: string; tag?: string; onClose?: () => void; range?: string; events?: ChartEvent[] }) {
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

  const isAllLanes = lane === 'all';
  const laneColor = isAllLanes ? (C.accent as string) : (C[lane as keyof typeof C] || C.accent) as string;
  const platforms = [...new Set(items.map(i => i.platform))];

  return (
    <div ref={containerRef} style={{ background: C.bgCard, border: `1px solid ${laneColor}30`, borderTop: `3px solid ${laneColor}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(30,58,95,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: laneColor, textTransform: 'uppercase', fontFamily: font, marginBottom: 4 }}>
            {isAllLanes ? 'Lane Overview' : `${lane} Trend`}
          </div>
          {tag && <div style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font }}>#{tag}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isAllLanes ? ALL_LANES.map(l => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 2, background: LANE_COLORS[l], borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: font }}>{l}</span>
            </div>
          )) : platforms.map(p => {
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

      {isAllLanes
        ? <AllLanesChartSVG items={items} width={width - 40} height={160} range={range} events={events} />
        : <LayeredChartSVG items={items} width={width - 40} height={160} lane={lane} range={range} useLaneColor events={events} />
      }
    </div>
  );
}
