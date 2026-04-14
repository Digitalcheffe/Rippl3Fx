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
  Reddit:      "#e8380d",
  GitHub:      "#0969da",
  GA4:         "#e6a817",
  Bing:        "#00897b",
  Reach:       "#0969da",
  Interest:    "#e6a817",
  Engagement:  "#e8380d",
  up:          "#0d9488",
  down:        "#e8380d",
  flat:        "#8baac8",
};

const PLATFORMS = ["Reddit", "GitHub", "GA4", "Bing"];
const PLATFORM_ICONS = { Reddit: "R", GitHub: "G", GA4: "A", Bing: "B" };
const TAGS = ["All", "NORA", "KaseLog", "Blog"];
const LANES = ["Reach", "Interest", "Engagement"];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_ITEMS = [
  {
    id: 1, platform: "Reddit", name: "Launched NORA on r/selfhosted", tags: ["NORA"],
    lanes: {
      Reach:      { current: 3200,  history: [280,  1800, 3200, 2900, 3000, 3100, 3200], velocity: +100  },
      Interest:   { current: 284,   history: [12,   180,  284,  278,  281,  282,  284],  velocity: +2    },
      Engagement: { current: 47,    history: [4,    28,   47,   45,   46,   47,   47],   velocity: 0     },
    },
    performance: [12, 48, 100, 90, 88, 91, 93],
  },
  {
    id: 2, platform: "GitHub", name: "Digitalcheffe/N.O.R.A", tags: ["NORA"],
    lanes: {
      Reach:      { current: 890,   history: [40,   220,  580,  750,  820,  860,  890],  velocity: +30   },
      Interest:   { current: 142,   history: [4,    22,   65,   110,  128,  138,  142],  velocity: +4    },
      Engagement: { current: 18,    history: [0,    2,    7,    12,   15,   17,   18],   velocity: +1    },
    },
    performance: [3, 18, 52, 78, 88, 94, 100],
  },
  {
    id: 3, platform: "GA4", name: "nora.itegasus.com", tags: ["NORA"],
    lanes: {
      Reach:      { current: 3870,  history: [90,   980,  2400, 3870, 2900, 3100, 3870], velocity: +770  },
      Interest:   { current: 980,   history: [28,   260,  620,  980,  740,  820,  980],  velocity: +160  },
      Engagement: { current: 1420,  history: [40,   380,  920,  1420, 1100, 1200, 1420], velocity: +220  },
    },
    performance: [4, 28, 66, 100, 74, 82, 100],
  },
  {
    id: 4, platform: "Bing", name: "nora.itegasus.com", tags: ["NORA"],
    lanes: {
      Reach:      { current: 2100,  history: [0,    80,   420,  1200, 1700, 1950, 2100], velocity: +150  },
      Interest:   { current: 340,   history: [0,    14,   72,   200,  280,  316,  340],  velocity: +24   },
      Engagement: { current: 16,    history: [0,    17,   17,   17,   16,   16,   16],   velocity: 0     },
    },
    performance: [0, 6, 32, 58, 82, 92, 100],
  },
  {
    id: 5, platform: "Reddit", name: "KaseLog — private ops journal", tags: ["KaseLog"],
    lanes: {
      Reach:      { current: 1100,  history: [80,   420,  780,  980,  1040, 1080, 1100], velocity: +20   },
      Interest:   { current: 91,    history: [8,    42,   72,   85,   88,   90,   91],   velocity: +1    },
      Engagement: { current: 14,    history: [1,    7,    11,   13,   13,   14,   14],   velocity: 0     },
    },
    performance: [7, 36, 62, 76, 80, 84, 86],
  },
  {
    id: 6, platform: "GitHub", name: "Digitalcheffe/KaseLog", tags: ["KaseLog"],
    lanes: {
      Reach:      { current: 210,   history: [10,   48,   110,  160,  185,  200,  210],  velocity: +10   },
      Interest:   { current: 38,    history: [2,    8,    18,   28,   33,   36,   38],   velocity: +2    },
      Engagement: { current: 4,     history: [0,    1,    2,    3,    3,    4,    4],    velocity: 0     },
    },
    performance: [4, 18, 42, 60, 70, 80, 86],
  },
];

const DAY_LABELS = ["D-6","D-5","D-4","D-3","D-2","D-1","Today"];

const ACCOUNT_STATS = {
  Reddit:  [{ label: "Post Karma", value: "14.2k" }, { label: "Comment Karma", value: "3.8k" }, { label: "Active Subs", value: "12" }, { label: "Account Age", value: "4 yrs" }],
  GitHub:  [{ label: "Total Stars", value: "842" }, { label: "Total Forks", value: "94" }, { label: "Watchers", value: "38" }, { label: "Followers", value: "127" }],
  GA4:     [{ label: "Total Sessions", value: "24.1k" }, { label: "Total Users", value: "18.4k" }, { label: "Pageviews", value: "71.3k" }, { label: "Avg Session", value: "2m 14s" }],
  Bing:    [{ label: "Impressions", value: "48.2k" }, { label: "Clicks", value: "6.1k" }, { label: "Avg CTR", value: "12.7%" }, { label: "Avg Rank", value: "4.2" }],
};

const DISCOVERY_ITEMS = {
  Reddit:  [{ name: "r/selfhosted — NORA post", id: "t3_abc123" }, { name: "r/homelab — Docker setup post", id: "t3_def456" }, { name: "r/opensource — KaseLog post", id: "t3_ghi789" }],
  GitHub:  [{ name: "Digitalcheffe/N.O.R.A", id: "nora" }, { name: "Digitalcheffe/KaseLog", id: "kaselog" }, { name: "Digitalcheffe/homelab-scripts", id: "scripts" }],
  GA4:     [{ name: "nora.itegasus.com", id: "prop/111" }, { name: "kaselog.com", id: "prop/222" }],
  Bing:    [{ name: "nora.itegasus.com", id: "site1" }, { name: "kaselog.com", id: "site2" }],
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (typeof n !== "number") return n;
  if (n >= 1000000) return `${(n/1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n/1000).toFixed(1)}k`;
  return n.toString();
};

const velColor = (v) => v > 0 ? C.up : v < 0 ? C.down : C.flat;
const velSign  = (v) => v > 0 ? "+" : "";
const velArrow = (v) => v > 0 ? "↑" : v < 0 ? "↓" : "—";

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color, width = 72, height = 24 }) => {
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * width,
    height - ((v - min) / range) * (height - 4) - 2
  ]);
  const line = pts.map(([x,y],i) => `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gid = `g${color.replace(/[^a-z0-9]/gi,"")}${width}`;
  return (
    <svg width={width} height={height} style={{display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`}/>
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color}/>
    </svg>
  );
};

// ─── PERFORMANCE TREND CHART ──────────────────────────────────────────────────
const PerformanceTrend = ({ items, width = 500, height = 80 }) => {
  // Average performance across all items per day
  const avgPerf = DAY_LABELS.map((_, di) => {
    const vals = items.map(i => i.performance[di]);
    return vals.reduce((a,b) => a+b, 0) / vals.length;
  });
  const max = Math.max(...avgPerf, 1);
  const min = Math.min(...avgPerf);
  const range = max - min || 1;
  const padL=28, padR=12, padT=8, padB=20;
  const cW = width-padL-padR, cH = height-padT-padB;
  const toX = i => padL + (i/(DAY_LABELS.length-1))*cW;
  const toY = v => padT + cH - ((v-min)/range)*cH;
  const pts = avgPerf.map((v,i) => [toX(i), toY(v)]);
  const line = pts.map(([x,y],i) => `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${toX(DAY_LABELS.length-1)},${padT+cH} L${toX(0)},${padT+cH} Z`;
  const gid = "perfgrad";
  const current = avgPerf[avgPerf.length-1];
  const prev = avgPerf[avgPerf.length-2];
  const trend = current > prev ? "↑" : current < prev ? "↓" : "—";
  const tColor = current > prev ? C.up : current < prev ? C.down : C.flat;

  return (
    <div style={{background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:20, boxShadow:"0 2px 8px rgba(30,58,95,0.07)"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12}}>
        <div>
          <div style={{fontSize:10, letterSpacing:3, color:C.textFaint, textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:4}}>Performance Trend</div>
          <div style={{fontSize:13, fontWeight:700, color:C.text, fontFamily:"'DM Mono',monospace"}}>Cross-platform momentum over time</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:28, fontWeight:900, color:tColor, fontFamily:"'DM Mono',monospace", lineHeight:1}}>{trend}</div>
          <div style={{fontSize:11, color:C.textFaint, fontFamily:"'DM Mono',monospace", marginTop:2}}>vs yesterday</div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{display:"block"}}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={C.accent} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[25,50,75].map(v => (
          <line key={v} x1={padL} y1={toY(min + (v/100)*range)} x2={width-padR} y2={toY(min+(v/100)*range)} stroke={C.border} strokeWidth="0.5" strokeDasharray="3,4"/>
        ))}
        <path d={area} fill={`url(#${gid})`}/>
        <path d={line} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.5" fill={C.accent}/>
        {DAY_LABELS.map((l,i) => (
          <text key={l} x={toX(i)} y={height-2} fontSize="8" fill={C.textFaint} textAnchor="middle" fontFamily="monospace">{l}</text>
        ))}
      </svg>
      <div style={{marginTop:8, fontSize:10, color:C.textFaint, fontFamily:"'DM Mono',monospace"}}>
        Weights: Reach 20% · Interest 30% · Engagement 50% · <span style={{color:C.accent, cursor:"pointer"}}>adjust in settings →</span>
      </div>
    </div>
  );
};

// ─── LANE ROW ─────────────────────────────────────────────────────────────────
const LaneRow = ({ lane, data, compact = false }) => {
  const color = C[lane];
  const vc = velColor(data.velocity);
  return (
    <div style={{display:"flex", alignItems:"center", gap:10}}>
      <div style={{width:compact?60:72, flexShrink:0, textAlign:"right"}}>
        <div style={{fontSize:9, color:C.textFaint, textTransform:"uppercase", letterSpacing:1, fontFamily:"'DM Mono',monospace"}}>{lane}</div>
        <div style={{fontSize:compact?14:16, fontWeight:900, color:C.text, fontFamily:"'DM Mono',monospace", lineHeight:1.2, letterSpacing:-0.5}}>{fmt(data.current)}</div>
      </div>
      <Sparkline data={data.history} color={color} width={compact?64:76} height={22}/>
      <div style={{fontSize:10, color:vc, fontWeight:700, fontFamily:"'DM Mono',monospace", minWidth:36, textAlign:"right"}}>
        {velArrow(data.velocity)} {velSign(data.velocity)}{fmt(Math.abs(data.velocity))}
      </div>
    </div>
  );
};

// ─── PLATFORM PILL ────────────────────────────────────────────────────────────
const PlatformPill = ({ platform }) => (
  <div style={{display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px 3px 5px", borderRadius:20, background:C[platform]+"14", border:`1px solid ${C[platform]}30`}}>
    <div style={{width:15, height:15, borderRadius:"50%", background:C[platform], display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:900, color:"#fff", fontFamily:"monospace"}}>{PLATFORM_ICONS[platform]}</div>
    <span style={{fontSize:10, fontWeight:700, color:C[platform], letterSpacing:0.8, textTransform:"uppercase", fontFamily:"'DM Mono',monospace"}}>{platform}</span>
  </div>
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────
const StatCard = ({ item, index }) => {
  const color = C[item.platform];
  return (
    <div style={{background:C.bgCard, border:`1px solid ${C.border}`, borderTop:`3px solid ${color}`, borderRadius:12, padding:"16px 18px", display:"flex", flexDirection:"column", gap:12, boxShadow:"0 2px 8px rgba(30,58,95,0.07)", animation:`fadeUp 0.4s ease both`, animationDelay:`${index*0.06}s`, transition:"box-shadow 0.2s, transform 0.2s, background 0.2s"}}
      onMouseEnter={e => {e.currentTarget.style.boxShadow=`0 8px 24px rgba(30,58,95,0.13), 0 0 0 1px ${color}25`; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.background=C.bgCardHover;}}
      onMouseLeave={e => {e.currentTarget.style.boxShadow="0 2px 8px rgba(30,58,95,0.07)"; e.currentTarget.style.transform="none"; e.currentTarget.style.background=C.bgCard;}}
    >
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{marginBottom:7}}><PlatformPill platform={item.platform}/></div>
          <div style={{fontSize:12, color:C.text, fontWeight:600, lineHeight:1.4, fontFamily:"'DM Mono',monospace"}}>{item.name}</div>
        </div>
        <div style={{display:"flex", gap:4, flexWrap:"wrap", justifyContent:"flex-end", paddingTop:2}}>
          {item.tags.map(t => (
            <span key={t} style={{fontSize:10, padding:"2px 7px", borderRadius:4, background:C.accentSoft, color:C.accent, border:`1px solid ${C.accent}30`, fontFamily:"'DM Mono',monospace"}}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{height:1, background:C.border}}/>

      {/* Three lanes */}
      <div style={{display:"flex", flexDirection:"column", gap:8}}>
        {LANES.map(lane => (
          <LaneRow key={lane} lane={lane} data={item.lanes[lane]} />
        ))}
      </div>
    </div>
  );
};

// ─── LANE SUMMARY BAR ─────────────────────────────────────────────────────────
// Rolled-up three lanes for tag/platform/all level
const LaneSummary = ({ items }) => {
  const totals = LANES.reduce((acc, lane) => {
    acc[lane] = {
      current: items.reduce((s, i) => s + (i.lanes[lane]?.current || 0), 0),
      velocity: items.reduce((s, i) => s + (i.lanes[lane]?.velocity || 0), 0),
    };
    return acc;
  }, {});

  return (
    <div style={{display:"flex", gap:12, marginBottom:20, flexWrap:"wrap"}}>
      {LANES.map(lane => {
        const d = totals[lane];
        const vc = velColor(d.velocity);
        return (
          <div key={lane} style={{flex:1, minWidth:160, background:C.bgCard, border:`1px solid ${C[lane]}30`, borderTop:`3px solid ${C[lane]}`, borderRadius:10, padding:"12px 16px", boxShadow:"0 2px 8px rgba(30,58,95,0.06)"}}>
            <div style={{fontSize:10, letterSpacing:2, color:C[lane], textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:4}}>{lane}</div>
            <div style={{fontSize:24, fontWeight:900, color:C.text, fontFamily:"'DM Mono',monospace", letterSpacing:-0.5, lineHeight:1}}>{fmt(d.current)}</div>
            <div style={{fontSize:11, color:vc, fontWeight:700, fontFamily:"'DM Mono',monospace", marginTop:4}}>{velArrow(d.velocity)} {velSign(d.velocity)}{fmt(Math.abs(d.velocity))} today</div>
          </div>
        );
      })}
    </div>
  );
};

// ─── ACCOUNT STATS ────────────────────────────────────────────────────────────
const AccountStats = ({ platform }) => (
  <div style={{background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px", marginBottom:16, boxShadow:"0 2px 8px rgba(30,58,95,0.06)"}}>
    <div style={{fontSize:10, letterSpacing:3, color:C.textFaint, textTransform:"uppercase", fontFamily:"'DM Mono',monospace", marginBottom:10}}>Account Overview</div>
    <div style={{display:"flex", gap:20, flexWrap:"wrap"}}>
      {ACCOUNT_STATS[platform].map(s => (
        <div key={s.label}>
          <div style={{fontSize:9, color:C.textFaint, textTransform:"uppercase", letterSpacing:1, fontFamily:"'DM Mono',monospace"}}>{s.label}</div>
          <div style={{fontSize:18, fontWeight:800, color:C[platform], fontFamily:"'DM Mono',monospace", lineHeight:1.3}}>{s.value}</div>
        </div>
      ))}
    </div>
  </div>
);

// ─── DISCOVERY PANEL ──────────────────────────────────────────────────────────
const DiscoveryPanel = ({ platform }) => {
  const [expanded, setExpanded] = useState(false);
  const [infoItem, setInfoItem] = useState(null);
  const items = DISCOVERY_ITEMS[platform] || [];

  return (
    <div style={{background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px", marginBottom:16, boxShadow:"0 2px 8px rgba(30,58,95,0.06)"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div style={{fontSize:10, letterSpacing:3, color:C.textFaint, textTransform:"uppercase", fontFamily:"'DM Mono',monospace"}}>Discoverable Content</div>
        <button onClick={() => setExpanded(!expanded)} style={{padding:"4px 12px", background:C[platform]+"18", border:`1px solid ${C[platform]}40`, borderRadius:6, color:C[platform], fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>
          {expanded ? "Hide ↑" : "Browse ↓"}
        </button>
      </div>
      {expanded && (
        <div style={{marginTop:12, display:"flex", flexDirection:"column", gap:8}}>
          {items.map(item => (
            <div key={item.id} style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:C.bgSection, borderRadius:8, border:`1px solid ${C.border}`}}>
              <span style={{fontSize:12, color:C.text, fontFamily:"'DM Mono',monospace"}}>{item.name}</span>
              <div style={{display:"flex", gap:8}}>
                <button onClick={() => setInfoItem(infoItem===item.id ? null : item.id)} style={{padding:"4px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textMid, fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>
                  Get Info
                </button>
                <button style={{padding:"4px 10px", background:C[platform], border:"none", borderRadius:5, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>
                  Tag & Track
                </button>
              </div>
            </div>
          ))}
          {infoItem && (
            <div style={{padding:"12px 14px", background:C.bgSection, borderRadius:8, border:`1px solid ${C[platform]}40`}}>
              <div style={{fontSize:10, color:C.textFaint, fontFamily:"'DM Mono',monospace", marginBottom:8}}>Live snapshot preview</div>
              <div style={{display:"flex", gap:16}}>
                {LANES.map(lane => (
                  <div key={lane}>
                    <div style={{fontSize:9, color:C.textFaint, textTransform:"uppercase", letterSpacing:1, fontFamily:"'DM Mono',monospace"}}>{lane}</div>
                    <div style={{fontSize:16, fontWeight:800, color:C[lane], fontFamily:"'DM Mono',monospace"}}>{fmt(Math.floor(Math.random()*500)+10)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const EmptyState = ({ platform }) => (
  <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 40px", gap:14, textAlign:"center"}}>
    <div style={{width:56, height:56, borderRadius:"50%", background:C[platform]+"15", border:`2px dashed ${C[platform]}40`, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <span style={{fontSize:20, fontWeight:900, color:C[platform], fontFamily:"monospace"}}>{PLATFORM_ICONS[platform]}</span>
    </div>
    <div style={{fontSize:16, fontWeight:700, color:C.text, fontFamily:"'DM Mono',monospace"}}>No {platform} account connected</div>
    <div style={{fontSize:12, color:C.textSoft, maxWidth:280, lineHeight:1.7, fontFamily:"'DM Mono',monospace"}}>Connect your account to start tracking. Browse your content and tag items to begin long-term polling.</div>
    <button style={{marginTop:6, padding:"9px 22px", borderRadius:8, background:C[platform], color:"#fff", border:"none", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>Connect {platform}</button>
  </div>
);

// ─── SETTINGS MODAL ───────────────────────────────────────────────────────────
const SettingsModal = ({ onClose }) => {
  const [tab, setTab] = useState("weights");
  const [weights, setWeights] = useState({ reach: 20, interest: 30, engagement: 50 });
  const tabs = [{ k:"weights", l:"Performance" }, { k:"profile", l:"Profile" }, { k:"password", l:"Password" }, { k:"totp", l:"2FA" }, { k:"accounts", l:"Accounts" }];
  const inp = {width:"100%", padding:"8px 12px", background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, fontSize:13, fontFamily:"'DM Mono',monospace", boxSizing:"border-box", outline:"none"};
  const btnP = {padding:"8px 20px", background:C.accent, border:"none", borderRadius:7, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace"};
  const total = weights.reach + weights.interest + weights.engagement;
  const valid = total === 100;

  return (
    <div style={{position:"fixed", inset:0, background:"rgba(13,31,53,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center"}}>
      <div style={{background:C.bgCard, border:`1px solid ${C.borderMid}`, borderRadius:14, width:540, maxHeight:"82vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(13,31,53,0.2)"}}>
        <div style={{padding:"16px 22px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <span style={{fontSize:14, fontWeight:700, color:C.text, fontFamily:"'DM Mono',monospace"}}>Settings</span>
          <button onClick={onClose} style={{background:"none", border:"none", color:C.textSoft, fontSize:18, cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex", borderBottom:`1px solid ${C.border}`, background:C.bg}}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{flex:1, padding:"10px 4px", background:"none", border:"none", borderBottom:tab===t.k?`2px solid ${C.accent}`:"2px solid transparent", color:tab===t.k?C.accent:C.textSoft, fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:0.8}}>{t.l}</button>
          ))}
        </div>
        <div style={{padding:22, overflowY:"auto"}}>

          {tab === "weights" && (
            <div style={{display:"flex", flexDirection:"column", gap:20}}>
              <div style={{fontSize:12, color:C.textMid, fontFamily:"'DM Mono',monospace", lineHeight:1.7}}>
                Adjust how each lane contributes to the Performance Trend. Values must sum to 100. The formula is shown beneath every performance chart.
              </div>
              {[["reach","Reach",C.Reach], ["interest","Interest",C.Interest], ["engagement","Engagement",C.Engagement]].map(([k,l,color]) => (
                <div key={k}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                    <label style={{fontSize:11, color, fontFamily:"'DM Mono',monospace", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8}}>{l}</label>
                    <span style={{fontSize:12, color:C.text, fontFamily:"'DM Mono',monospace", fontWeight:700}}>{weights[k]}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={weights[k]}
                    onChange={e => setWeights({...weights, [k]: parseInt(e.target.value)})}
                    style={{width:"100%", accentColor:color}}
                  />
                  <div style={{height:4, background:C.bgSection, borderRadius:2, marginTop:4}}>
                    <div style={{height:"100%", width:`${weights[k]}%`, background:color, borderRadius:2, transition:"width 0.2s"}}/>
                  </div>
                </div>
              ))}
              <div style={{padding:"10px 14px", borderRadius:8, background:valid?C.bgSection:"#ffeaea", border:`1px solid ${valid?C.border:"#ffaaaa"}`, fontFamily:"'DM Mono',monospace", fontSize:12}}>
                <span style={{color:valid?C.textMid:"#c00", fontWeight:700}}>
                  {valid ? `✓ Formula: Reach ${weights.reach}% · Interest ${weights.interest}% · Engagement ${weights.engagement}%` : `⚠ Weights sum to ${total}% — must equal 100%`}
                </span>
              </div>
              <button style={{...btnP, alignSelf:"flex-start", opacity:valid?1:0.5}} disabled={!valid}>Save Weights</button>
            </div>
          )}

          {tab === "profile" && (
            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              {[["Display Name","Ryan"],["Username","digitalcheffe"]].map(([l,v]) => (
                <div key={l}>
                  <label style={{fontSize:10, color:C.textSoft, display:"block", marginBottom:5, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:0.8}}>{l}</label>
                  <input defaultValue={v} style={inp}/>
                </div>
              ))}
              <button style={{...btnP, alignSelf:"flex-start"}}>Save Changes</button>
            </div>
          )}

          {tab === "password" && (
            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              {["Current Password","New Password","Confirm Password"].map(l => (
                <div key={l}>
                  <label style={{fontSize:10, color:C.textSoft, display:"block", marginBottom:5, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:0.8}}>{l}</label>
                  <input type="password" style={inp}/>
                </div>
              ))}
              <button style={{...btnP, alignSelf:"flex-start"}}>Update Password</button>
            </div>
          )}

          {tab === "totp" && (
            <div style={{display:"flex", flexDirection:"column", gap:14}}>
              <div style={{padding:"10px 14px", background:C.Bing+"15", border:`1px solid ${C.Bing}40`, borderRadius:8, color:C.Bing, fontSize:12, fontFamily:"'DM Mono',monospace"}}>✓ Two-factor authentication is enabled</div>
              <p style={{margin:0, fontSize:12, color:C.textMid, lineHeight:1.7, fontFamily:"'DM Mono',monospace"}}>TOTP is active. Use your authenticator app on each login.</p>
              <div style={{display:"flex", gap:10}}>
                <button style={{padding:"8px 16px", background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:7, color:C.textMid, fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>Regenerate QR</button>
                <button style={{padding:"8px 16px", background:C.bgInput, border:"1px solid #e8380d55", borderRadius:7, color:"#e8380d", fontSize:12, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>Disable 2FA</button>
              </div>
            </div>
          )}

          {tab === "accounts" && (
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {["Reddit","GitHub"].map(p => (
                <div key={p} style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div><PlatformPill platform={p}/><div style={{fontSize:10, color:C.textFaint, marginTop:5, fontFamily:"'DM Mono',monospace"}}>Connected · polls every 60 min</div></div>
                  <div style={{display:"flex", gap:8}}>
                    <button style={{padding:"4px 10px", background:"none", border:`1px solid ${C.border}`, borderRadius:5, color:C.textMid, fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>Edit</button>
                    <button style={{padding:"4px 10px", background:"none", border:"1px solid #e8380d55", borderRadius:5, color:"#e8380d", fontSize:11, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>Remove</button>
                  </div>
                </div>
              ))}
              {["GA4","Bing"].map(p => (
                <div key={p} style={{background:C.bg, border:`1px dashed ${C.borderMid}`, borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <span style={{fontSize:12, color:C.textFaint, fontFamily:"'DM Mono',monospace"}}>{p} — not connected</span>
                  <button style={{padding:"4px 12px", background:C[p]+"15", border:`1px solid ${C[p]}40`, borderRadius:5, color:C[p], fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Mono',monospace"}}>Connect</button>
                </div>
              ))}
              <button style={{marginTop:4, ...btnP, alignSelf:"flex-start"}}>+ Add Account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function Rippl3FXApp() {
  const [activePage, setActivePage] = useState("all");
  const [activeTag, setActiveTag] = useState("NORA");
  const [showSettings, setShowSettings] = useState(false);

  const filtered = MOCK_ITEMS.filter(item => {
    const pageMatch = activePage === "all" || item.platform.toLowerCase() === activePage;
    const tagMatch = activeTag === "All" || item.tags.includes(activeTag);
    return pageMatch && tagMatch;
  });

  const activePlatform = activePage !== "all"
    ? activePage.charAt(0).toUpperCase() + activePage.slice(1)
    : null;
  const platformHasAccount = activePlatform
    ? MOCK_ITEMS.some(i => i.platform === activePlatform)
    : true;

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Mono',monospace"}}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
      `}</style>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)}/>}

      {/* Nav */}
      <div style={{background:C.bgNav, padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, zIndex:50, boxShadow:"0 2px 12px rgba(13,31,53,0.18)"}}>
        <div style={{display:"flex", alignItems:"center", gap:24}}>
          <div style={{fontSize:15, fontWeight:900, letterSpacing:0.5, fontFamily:"'DM Mono',monospace"}}>
            <span style={{color:C.accent}}>Rippl</span><span style={{color:C.GA4}}>3</span><span style={{color:"#ffffff"}}>FX</span>
          </div>
          <div style={{display:"flex", gap:1}}>
            {[{k:"all",l:"All Metrics"}, ...PLATFORMS.map(p => ({k:p.toLowerCase(),l:p}))].map(nav => (
              <button key={nav.k} onClick={() => setActivePage(nav.k)} style={{padding:"5px 12px", background:activePage===nav.k?"rgba(255,255,255,0.1)":"none", border:"none", borderRadius:6, color:activePage===nav.k?"#fff":"rgba(255,255,255,0.5)", fontSize:11, fontWeight:activePage===nav.k?700:400, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:0.3, borderBottom:activePage===nav.k?`2px solid ${nav.k==="all"?C.accent:C[nav.l]||C.accent}`:"2px solid transparent", transition:"all 0.15s"}}>{nav.l}</button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} style={{background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, padding:"5px 14px", color:"rgba(255,255,255,0.7)", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:0.8, fontWeight:600, textTransform:"uppercase"}}>⚙ Settings</button>
      </div>

      <div style={{padding:"28px 28px 48px"}}>

        {/* Page header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20}}>
          <div>
            <div style={{fontSize:10, letterSpacing:3, color:C.textFaint, textTransform:"uppercase", marginBottom:5, fontFamily:"'DM Mono',monospace"}}>{activePage==="all"?"Dashboard":"Platform"}</div>
            <h1 style={{margin:0, fontSize:24, fontWeight:900, color:C.text, letterSpacing:-0.5, fontFamily:"'DM Mono',monospace"}}>{activePage==="all"?"All Metrics":activePlatform}</h1>
          </div>
          {activePage === "all" && (
            <div style={{display:"flex", gap:6, alignItems:"center"}}>
              <span style={{fontSize:10, color:C.textFaint, marginRight:4, letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'DM Mono',monospace"}}>Tag</span>
              {TAGS.map(t => (
                <button key={t} onClick={() => setActiveTag(t)} style={{padding:"4px 12px", borderRadius:6, border:`1px solid ${activeTag===t?C.accent:C.border}`, background:activeTag===t?C.accent+"18":"transparent", color:activeTag===t?C.accent:C.textMid, fontSize:11, fontWeight:activeTag===t?700:400, cursor:"pointer", fontFamily:"'DM Mono',monospace", letterSpacing:0.5, transition:"all 0.15s"}}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* ALL METRICS PAGE */}
        {activePage === "all" && (
          <>
            {/* Three lane summary */}
            <LaneSummary items={filtered}/>
            {/* Performance trend */}
            {filtered.length > 0 && <PerformanceTrend items={filtered}/>}
            {/* Cards */}
            {filtered.length === 0 ? (
              <div style={{textAlign:"center", padding:"60px 0", color:C.textSoft, fontSize:13, fontFamily:"'DM Mono',monospace"}}>No items tagged "{activeTag}" yet.</div>
            ) : (
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:14}}>
                {filtered.map((item,i) => <StatCard key={item.id} item={item} index={i}/>)}
              </div>
            )}
          </>
        )}

        {/* PLATFORM PAGE */}
        {activePage !== "all" && (
          !platformHasAccount ? (
            <EmptyState platform={activePlatform}/>
          ) : (
            <>
              {/* Account stats */}
              <AccountStats platform={activePlatform}/>
              {/* Three lane summary for this platform */}
              <LaneSummary items={filtered}/>
              {/* Performance trend for this platform */}
              {filtered.length > 0 && <PerformanceTrend items={filtered}/>}
              {/* Discovery panel */}
              <DiscoveryPanel platform={activePlatform}/>
              {/* Tracked items */}
              {filtered.length > 0 && (
                <>
                  <div style={{fontSize:10, letterSpacing:3, color:C.textFaint, textTransform:"uppercase", marginBottom:12, fontFamily:"'DM Mono',monospace"}}>Tracked Items</div>
                  <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:14}}>
                    {filtered.map((item,i) => <StatCard key={item.id} item={item} index={i}/>)}
                  </div>
                </>
              )}
            </>
          )
        )}

      </div>
    </div>
  );
}
