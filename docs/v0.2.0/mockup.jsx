import { useState, useRef, useEffect } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#eef4fb",
  bgCard:      "#f8fbff",
  bgCardHover: "#ffffff",
  bgNav:       "#1e3a5f",
  bgNavItem:   "#24476e",
  bgInput:     "#e6eef8",
  bgSection:   "#e8f0f9",
  text:        "#0d1f35",
  textMid:     "#2d5282",
  textSoft:    "#5a7fa8",
  textFaint:   "#8baac8",
  border:      "#cfe0f0",
  borderMid:   "#a8c4e0",
  accent:      "#e8622a",
  accentSoft:  "#e8622a18",
  GitHub:      "#0969da",
  GA4:         "#e6a817",
  Bing:        "#00897b",
  Reach:       "#0969da",
  Interest:    "#0d9488",
  Engagement:  "#e8380d",
  up:          "#0d9488",
  down:        "#e8380d",
  flat:        "#8baac8",
};

const font = "'DM Mono', monospace";
const PLATFORMS = ["GitHub", "GA4", "Bing"];
const LANES = ["Reach", "Interest", "Engagement"];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────

const MOCK_TOTALS = {
  Reach:      { current: 4760, prev: 3200, history: [1200, 2400, 3800, 4200, 3900, 4100, 4760] },
  Interest:   { current: 189,  prev: 142,  history: [45, 80, 120, 160, 170, 178, 189] },
  Engagement: { current: 67,   prev: 48,   history: [12, 28, 42, 55, 58, 62, 67] },
};

const MOCK_PLATFORM_DATA = {
  GitHub: {
    Reach: [400, 800, 1200, 1400, 1300, 1350, 1500],
    Interest: [20, 40, 60, 80, 85, 88, 95],
    Engagement: [5, 12, 18, 25, 27, 30, 32],
  },
  GA4: {
    Reach: [700, 1400, 2200, 2400, 2200, 2350, 2800],
    Interest: [20, 35, 50, 70, 75, 80, 82],
    Engagement: [6, 14, 20, 25, 26, 27, 30],
  },
  Bing: {
    Reach: [100, 200, 400, 400, 400, 400, 460],
    Interest: [5, 5, 10, 10, 10, 10, 12],
    Engagement: [1, 2, 4, 5, 5, 5, 5],
  },
};

const MOCK_EVENTS = [
  { id: 1, name: "Blog: Why I Built Rippl3FX", date: "Apr 13", daysActive: 1, ripple: 95, trend: "Spiking",
    lanes: { Reach: 92, Interest: 100, Engagement: 90 } },
  { id: 2, name: "N.O.R.A v2.0 Release", date: "Apr 10", daysActive: 4, ripple: 72, trend: "Fading",
    lanes: { Reach: 55, Interest: 82, Engagement: 74 } },
  { id: 3, name: "4LeafClover Reddit Post", date: "Apr 3", daysActive: 11, ripple: 14, trend: "Absorbed",
    lanes: { Reach: 8, Interest: 18, Engagement: 14 } },
];

const MOCK_GA4_PAGES = [
  { path: "/",                    sessions: 1240, users: 890, pageviews: 3200, engRate: 0.68, bounce: 0.32 },
  { path: "/blog/4leafclover",    sessions: 380,  users: 310, pageviews: 620,  engRate: 0.82, bounce: 0.18 },
  { path: "/projects/nora",       sessions: 290,  users: 240, pageviews: 480,  engRate: 0.74, bounce: 0.26 },
  { path: "/about",               sessions: 180,  users: 160, pageviews: 220,  engRate: 0.45, bounce: 0.55 },
  { path: "/blog/why-rippl3fx",   sessions: 520,  users: 480, pageviews: 840,  engRate: 0.88, bounce: 0.12 },
  { path: "/contact",             sessions: 90,   users: 85,  pageviews: 110,  engRate: 0.35, bounce: 0.65 },
];

const MOCK_GITHUB_REPOS = [
  { name: "N.O.R.A",       stars: 142, forks: 18, views: 890,  clones: 45, issues: 12 },
  { name: "4LeafClover",   stars: 38,  forks: 5,  views: 320,  clones: 12, issues: 3 },
  { name: "Rippl3FX",      stars: 24,  forks: 2,  views: 290,  clones: 8,  issues: 8 },
];

const DATES_7 = ["4/8", "4/9", "4/10", "4/11", "4/12", "4/13", "Today"];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function Nav({ page, setPage }) {
  const items = [
    { key: "dashboard", label: "Dashboard" },
    { key: "events", label: "Events" },
    { key: "github", label: "GitHub" },
    { key: "ga4", label: "GA4" },
    { key: "bing", label: "Bing" },
  ];
  return (
    <div style={{ background: C.bgNav, padding: "0 28px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(13,31,53,0.18)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 900, fontFamily: font, cursor: "pointer" }} onClick={() => setPage("dashboard")}>
          <span style={{ color: C.accent }}>Rippl</span>
          <span style={{ color: C.GA4 }}>3</span>
          <span style={{ color: "#fff" }}>FX</span>
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {items.map(n => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{
              padding: "5px 12px", background: page === n.key ? "rgba(255,255,255,0.1)" : "none",
              border: "none", borderRadius: 6, color: page === n.key ? "#fff" : "rgba(255,255,255,0.5)",
              fontSize: 11, fontWeight: page === n.key ? 700 : 400, cursor: "pointer", fontFamily: font,
              letterSpacing: 0.3, borderBottom: page === n.key ? `2px solid ${C.accent}` : "2px solid transparent",
            }}>{n.label}</button>
          ))}
        </div>
      </div>
      <button style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 14px", color: "rgba(255,255,255,0.7)", fontSize: 10, cursor: "pointer", fontFamily: font, letterSpacing: 0.8, fontWeight: 600, textTransform: "uppercase" }}>
        Settings
      </button>
    </div>
  );
}

/** Single lane card — current value, change, % change */
function LaneCard({ lane, data }) {
  const color = C[lane];
  const change = data.current - data.prev;
  const pct = data.prev > 0 ? ((change / data.prev) * 100).toFixed(1) : "0.0";
  const isUp = change > 0;
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${color}30`, borderTop: `3px solid ${color}`,
      borderRadius: 12, padding: "14px 18px", flex: 1, minWidth: 180,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2.5, color, textTransform: "uppercase", fontFamily: font, fontWeight: 700, marginBottom: 10 }}>{lane}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Today</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.text, fontFamily: font, lineHeight: 1 }}>{data.current.toLocaleString()}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Change</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: isUp ? C.up : C.down, fontFamily: font }}>
            {isUp ? "+" : ""}{change.toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>% Change</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: isUp ? C.up : C.down, fontFamily: font }}>
            {isUp ? "+" : ""}{pct}%
          </div>
        </div>
      </div>
    </div>
  );
}

/** Platform toggle chips */
function PlatformToggles({ active, setActive }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: font }}>Platforms</span>
      {PLATFORMS.map(p => {
        const on = active.includes(p);
        const color = C[p];
        return (
          <button key={p} onClick={() => setActive(prev => on ? prev.filter(x => x !== p) : [...prev, p])} style={{
            padding: "4px 10px", borderRadius: 12, fontSize: 11, fontFamily: font, fontWeight: 600,
            border: on ? `1.5px solid ${color}` : `1px solid ${C.border}`,
            background: on ? `${color}15` : C.bgInput, color: on ? color : C.textSoft, cursor: "pointer",
          }}>{p}</button>
        );
      })}
    </div>
  );
}

/** Time range selector with load-more */
function TimeNav({ range, setRange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", background: C.bgInput, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {["daily", "weekly", "monthly"].map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: "5px 12px", background: range === r ? C.accent : "transparent",
            border: "none", color: range === r ? "#fff" : C.textMid,
            fontSize: 10, fontWeight: range === r ? 700 : 400,
            cursor: "pointer", fontFamily: font, textTransform: "uppercase", letterSpacing: 0.5,
          }}>{r}</button>
        ))}
      </div>
      <button style={{
        padding: "4px 10px", background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
        fontSize: 10, color: C.textMid, fontFamily: font, cursor: "pointer",
      }}>← Load Previous</button>
    </div>
  );
}

/** SVG mini chart for the lane overview */
function MiniChart({ data, color, width = 280, height = 50, labels }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [8 + (i / (data.length - 1)) * (width - 16), 4 + (height - 12) - (v / max) * (height - 12)]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${height - 4} L${pts[0][0]},${height - 4} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={color} />)}
    </svg>
  );
}

/** Ripple ring */
function RippleRing({ value, size = 44 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 70 ? C.up : value >= 30 ? C.GA4 : value > 0 ? C.down : C.border;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: size > 60 ? 20 : 12, fontWeight: 900, color, fontFamily: font }}>{value}</div>
    </div>
  );
}

/** Active ripples summary row */
function ActiveRipples() {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.accent}30`, borderTop: `3px solid ${C.accent}`, borderRadius: 12, padding: "14px 20px", marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", fontFamily: font, marginBottom: 10 }}>Active Ripples</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {MOCK_EVENTS.map(ev => {
          const trendColor = ev.trend === "Spiking" ? C.up : C.down;
          return (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.bg, borderRadius: 10, padding: "10px 14px", minWidth: 220 }}>
              <RippleRing value={ev.ripple} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: font }}>{ev.name}</div>
                <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Day {ev.daysActive} · {ev.date}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: trendColor, fontFamily: font }}>
                  {ev.trend === "Spiking" ? "↑" : "↓"} {ev.trend}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Lane Overview chart with platform layers and event markers */
function LaneOverview({ activePlatforms, range }) {
  const w = 600, h = 160;
  const padL = 48, padR = 12, padT = 22, padB = 24;
  const cW = w - padL - padR, cH = h - padT - padB;

  // Aggregate data for active platforms
  const combined = DATES_7.map((_, i) => {
    let r = 0, int = 0, e = 0;
    activePlatforms.forEach(p => {
      const d = MOCK_PLATFORM_DATA[p];
      if (d) { r += d.Reach[i]; int += d.Interest[i]; e += d.Engagement[i]; }
    });
    return { reach: r, interest: int, engagement: e };
  });

  const allVals = combined.flatMap(d => [d.reach, d.interest, d.engagement]);
  const maxVal = Math.max(...allVals, 1);
  const toX = i => padL + (i / 6) * cW;
  const toY = v => padT + cH - (v / maxVal) * cH;

  const makeLine = (key) => combined.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`).join(" ");

  // Event marker at index 5 (Apr 13 = "Blog: Why I Built Rippl3FX")
  const evIdx = 5;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.accent}30`, borderTop: `3px solid ${C.accent}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: C.accent, textTransform: "uppercase", fontFamily: font }}>Lane Overview</div>
        <div style={{ display: "flex", gap: 12 }}>
          {LANES.map(l => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 2, background: C[l], borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: C.textFaint, fontFamily: font }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {/* Grid */}
        {[25, 50, 75, 100].map(pct => {
          const y = toY((pct / 100) * maxVal);
          return <g key={pct}><line x1={padL} y1={y} x2={w - padR} y2={y} stroke={C.border} strokeWidth={0.5} strokeDasharray="4,4" /><text x={padL - 4} y={y + 3} fontSize="9" fill={C.textFaint} textAnchor="end" fontFamily="monospace">{Math.round((pct / 100) * maxVal)}</text></g>;
        })}
        {/* X labels */}
        {DATES_7.map((l, i) => <text key={i} x={toX(i)} y={h - 4} fontSize="9" fill={C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>)}
        {/* Event marker */}
        <line x1={toX(evIdx)} y1={padT} x2={toX(evIdx)} y2={padT + cH} stroke={C.accent} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
        <circle cx={toX(evIdx)} cy={padT - 2} r={3} fill={C.accent} />
        <text x={toX(evIdx) + 5} y={padT - 4} fontSize="8" fill={C.accent} fontFamily={font} fontWeight="700">Blog Post</text>
        {/* Lane lines */}
        {[{ key: "reach", color: C.Reach }, { key: "interest", color: C.Interest }, { key: "engagement", color: C.Engagement }].map(({ key, color }) => {
          const line = makeLine(key);
          const area = `${line} L${toX(6)},${padT + cH} L${toX(0)},${padT + cH} Z`;
          const pts = combined.map((d, i) => [toX(i), toY(d[key])]);
          return (
            <g key={key}>
              <path d={area} fill={color} opacity={0.1} />
              <path d={line} fill="none" stroke={color} strokeWidth={2} opacity={0.8} strokeLinejoin="round" />
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill={color} />)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

function DashboardPage() {
  const [range, setRange] = useState("daily");
  const [activePlatforms, setActivePlatforms] = useState([...PLATFORMS]);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: "uppercase", fontFamily: font, marginBottom: 5 }}>Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>All Metrics</h1>
        </div>
        <TimeNav range={range} setRange={setRange} />
      </div>
      <hr style={{ border: "none", borderTop: `3px solid ${C.borderMid}`, margin: "10px 0 16px" }} />

      {/* Platform toggles */}
      <div style={{ marginBottom: 16 }}>
        <PlatformToggles active={activePlatforms} setActive={setActivePlatforms} />
      </div>

      {/* Three lane cards — no performance score */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
        {LANES.map(lane => <LaneCard key={lane} lane={lane} data={MOCK_TOTALS[lane]} />)}
      </div>

      {/* Active Ripples */}
      <ActiveRipples />

      {/* Lane Overview Chart */}
      <LaneOverview activePlatforms={activePlatforms} range={range} />

      {/* Platform breakdown cards */}
      <div style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: "uppercase", fontFamily: font, marginBottom: 8 }}>Platform Breakdown</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${activePlatforms.length}, 1fr)`, gap: 14 }}>
        {activePlatforms.map(p => {
          const color = C[p];
          const data = MOCK_PLATFORM_DATA[p];
          return (
            <div key={p} style={{ background: C.bgCard, border: `1px solid ${color}30`, borderTop: `3px solid ${color}`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: font, marginBottom: 8 }}>{p}</div>
              {LANES.map(lane => {
                const hist = data[lane];
                const val = hist[hist.length - 1];
                return (
                  <div key={lane} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, color: C.textSoft, fontFamily: font, minWidth: 70 }}>{lane}</span>
                    <MiniChart data={hist} color={C[lane]} width={120} height={28} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: font }}>{val.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventsPage() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, fontFamily: font, color: C.text }}>Events</h1>
        <button style={{ padding: "8px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, fontFamily: font, cursor: "pointer" }}>+ New Event</button>
      </div>
      <p style={{ fontSize: 12, color: C.textSoft, fontFamily: font, marginBottom: 16 }}>Mark moments that create ripples. Track how far each one spreads.</p>
      <hr style={{ border: "none", borderTop: `2px solid ${C.border}`, margin: "0 0 20px" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {MOCK_EVENTS.map(ev => {
          const trendColor = ev.trend === "Spiking" ? C.up : C.down;
          return (
            <div key={ev.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: font }}>{ev.name}</div>
                  <div style={{ fontSize: 10, color: C.textSoft, fontFamily: font }}>{ev.date} · Day {ev.daysActive}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
                <RippleRing value={ev.ripple} size={80} />
                <div style={{ flex: 1 }}>
                  {LANES.map(lane => (
                    <div key={lane} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: C[lane], flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: C.textSoft, fontFamily: font, minWidth: 70 }}>{lane}</span>
                      <div style={{ flex: 1, height: 6, background: C.bgInput, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${ev.lanes[lane]}%`, background: C[lane], borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: font, minWidth: 24, textAlign: "right" }}>{ev.lanes[lane]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: C.bgSection, borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font, textTransform: "uppercase", letterSpacing: 1 }}>Peak Day</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: C.textMid, fontFamily: font }}>{ev.daysActive === 1 ? "Today" : `Day ${Math.min(ev.daysActive, 2)}`}</div>
                </div>
                <div style={{ flex: 1, background: C.bgSection, borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font, textTransform: "uppercase", letterSpacing: 1 }}>Days Active</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: C.textMid, fontFamily: font }}>{ev.daysActive}</div>
                </div>
                <div style={{ flex: 1, background: C.bgSection, borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font, textTransform: "uppercase", letterSpacing: 1 }}>Trend</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: trendColor, fontFamily: font }}>{ev.trend === "Spiking" ? "↑" : "↓"} {ev.trend}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GA4Page() {
  const [sortBy, setSortBy] = useState("sessions");
  const sorted = [...MOCK_GA4_PAGES].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: "uppercase", fontFamily: font, marginBottom: 5 }}>Platform</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.GA4, letterSpacing: -0.5, fontFamily: font }}>GA4</h1>
        </div>
      </div>
      <hr style={{ border: "none", borderTop: `3px solid ${C.borderMid}`, margin: "10px 0 16px" }} />

      {/* Property-wide summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.Reach}30`, borderTop: `3px solid ${C.Reach}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.Reach, textTransform: "uppercase", fontFamily: font, marginBottom: 4 }}>Reach</div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Total Pageviews</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: font, color: C.text }}>5,472</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.Interest}30`, borderTop: `3px solid ${C.Interest}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.Interest, textTransform: "uppercase", fontFamily: font, marginBottom: 4 }}>Interest</div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Total Users</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: font, color: C.text }}>2,165</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.Engagement}30`, borderTop: `3px solid ${C.Engagement}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.Engagement, textTransform: "uppercase", fontFamily: font, marginBottom: 4 }}>Engagement</div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Avg Engagement Rate</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: font, color: C.text }}>65.3%</div>
        </div>
      </div>

      {/* All pages table */}
      <div style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: "uppercase", fontFamily: font, marginBottom: 8 }}>All Pages</div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font, fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.bgSection }}>
              <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, color: C.textMid, fontWeight: 600, letterSpacing: 1 }}>Page</th>
              {["sessions", "users", "pageviews", "engRate", "bounce"].map(col => (
                <th key={col} onClick={() => setSortBy(col)} style={{
                  textAlign: "right", padding: "10px 14px", fontSize: 10, color: sortBy === col ? C.accent : C.textMid,
                  fontWeight: 600, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase",
                }}>
                  {col === "engRate" ? "Eng Rate" : col === "bounce" ? "Bounce" : col}
                  {sortBy === col ? " ↓" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((page, i) => (
              <tr key={page.path} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : C.bg + "44" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: C.text }}>{page.path}</td>
                <td style={{ textAlign: "right", padding: "10px 14px", color: C.textMid }}>{page.sessions.toLocaleString()}</td>
                <td style={{ textAlign: "right", padding: "10px 14px", color: C.textMid }}>{page.users.toLocaleString()}</td>
                <td style={{ textAlign: "right", padding: "10px 14px", fontWeight: 700, color: C.text }}>{page.pageviews.toLocaleString()}</td>
                <td style={{ textAlign: "right", padding: "10px 14px", color: page.engRate >= 0.7 ? C.up : C.textMid }}>{(page.engRate * 100).toFixed(0)}%</td>
                <td style={{ textAlign: "right", padding: "10px 14px", color: page.bounce >= 0.5 ? C.down : C.textMid }}>{(page.bounce * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GitHubPage() {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: "uppercase", fontFamily: font, marginBottom: 5 }}>Platform</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.GitHub, letterSpacing: -0.5, fontFamily: font, marginBottom: 0 }}>GitHub</h1>
      <hr style={{ border: "none", borderTop: `3px solid ${C.borderMid}`, margin: "10px 0 16px" }} />

      {/* Account summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.Reach}30`, borderTop: `3px solid ${C.Reach}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.Reach, textTransform: "uppercase", fontFamily: font, marginBottom: 4 }}>Reach</div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Total Traffic Views</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: font, color: C.text }}>1,500</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.Interest}30`, borderTop: `3px solid ${C.Interest}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.Interest, textTransform: "uppercase", fontFamily: font, marginBottom: 4 }}>Interest</div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Total Stars</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: font, color: C.text }}>204</div>
        </div>
        <div style={{ background: C.bgCard, border: `1px solid ${C.Engagement}30`, borderTop: `3px solid ${C.Engagement}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: C.Engagement, textTransform: "uppercase", fontFamily: font, marginBottom: 4 }}>Engagement</div>
          <div style={{ fontSize: 9, color: C.textSoft, fontFamily: font }}>Total Forks + Clones</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: font, color: C.text }}>90</div>
        </div>
      </div>

      {/* All repos */}
      <div style={{ fontSize: 10, letterSpacing: 2, color: C.textMid, textTransform: "uppercase", fontFamily: font, marginBottom: 8 }}>All Repositories</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {MOCK_GITHUB_REPOS.map(repo => (
          <div key={repo.name} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.GitHub, fontFamily: font, marginBottom: 10 }}>{repo.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
              {[
                { label: "Stars", val: repo.stars, color: C.Interest },
                { label: "Forks", val: repo.forks, color: C.Engagement },
                { label: "Views", val: repo.views, color: C.Reach },
                { label: "Clones", val: repo.clones, color: C.Engagement },
                { label: "Issues", val: repo.issues, color: C.textMid },
              ].map(m => (
                <div key={m.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: C.textSoft, fontFamily: font }}>{m.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.color, fontFamily: font }}>{m.val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

export default function Rippl3FXv02Mockup() {
  const [page, setPage] = useState("dashboard");

  const renderPage = () => {
    switch (page) {
      case "events": return <EventsPage />;
      case "ga4": return <GA4Page />;
      case "github": return <GitHubPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: font }}>
      <Nav page={page} setPage={setPage} />
      <div style={{ padding: "28px 28px 48px", maxWidth: 1100, margin: "0 auto" }}>
        {renderPage()}
      </div>
    </div>
  );
}
