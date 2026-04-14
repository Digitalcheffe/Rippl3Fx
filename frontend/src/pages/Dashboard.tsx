import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../theme';
import { apiGet } from '../api/client';
import LaneSummary from '../components/LaneSummary';
import LayeredInterestChart, { type ChartEvent } from '../components/LayeredInterestChart';
import StatCard, { type StatCardItem } from '../components/StatCard';
import SkeletonCard from '../components/SkeletonCard';

const font = "'DM Mono', monospace";

interface DashboardItem {
  id: number;
  platform: string;
  display_name: string;
  platform_identifier: string;
  tags: string[];
  reach: number;
  interest: number;
  engagement: number;
  performanceScore: number;
  velocity: { reach: number; interest: number; engagement: number };
  performanceVelocity: number;
  reachHistory: number[];
  interestHistory: number[];
  engagementHistory: number[];
  performanceHistory: number[];
  latestSnapshot: Record<string, any> | null;
}

interface PlatformData {
  reach: number;
  interest: number;
  engagement: number;
  performanceScore: number;
  velocity: { reach: number; interest: number; engagement: number };
  performanceVelocity: number;
  periodStart?: string;
  periodEnd?: string;
  peaks?: { reach_peak: number; interest_peak: number; engagement_peak: number };
}

/** Format a period date range for display (e.g., "Apr 7–13"). */
function formatPeriodLabel(range: string, periodStart?: string | null, periodEnd?: string | null): string {
  if ((range === 'weekly' || range === 'monthly') && periodStart && periodEnd) {
    const s = new Date(periodStart + 'T12:00:00');
    const e = new Date(periodEnd + 'T12:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (s.getMonth() === e.getMonth()) {
      return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
    }
    return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}`;
  }
  return { hourly: 'this hour', daily: 'today', weekly: 'this week', monthly: 'this month' }[range] || range;
}

interface DashboardResponse {
  items: DashboardItem[];
  platforms: Record<string, PlatformData>;
  totals: {
    reach: number;
    interest: number;
    engagement: number;
    performanceScore: number;
    velocity: { reach: number; interest: number; engagement: number };
    performanceVelocity: number;
    peaks?: { reach_peak: number; interest_peak: number; engagement_peak: number };
  };
  distribution: Record<string, { reach: number; interest: number; engagement: number }>;
  weights: { reach: number; interest: number; engagement: number };
}

interface Tag {
  id: number;
  name: string;
}

function capPlatform(p: string): string {
  return p === 'ga4' ? 'GA4' : p.charAt(0).toUpperCase() + p.slice(1);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTag, setActiveTag] = useState('All');
  const [timeRange, setTimeRange] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const [events, setEvents] = useState<ChartEvent[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTag !== 'All') params.set('tag', activeTag);
      params.set('range', timeRange);
      const resp = await apiGet<DashboardResponse>(`/dashboard?${params}`);
      setData(resp);
    } catch (err) { setError('Failed to load dashboard data'); }
    setLoading(false);
  }, [activeTag, timeRange]);

  useEffect(() => { apiGet<Tag[]>('/tags').then(setTags).catch(() => {}); }, []);
  useEffect(() => { apiGet<ChartEvent[]>('/events').then(setEvents).catch(() => {}); }, []);
  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => { const i = setInterval(fetchData, 5 * 60 * 1000); return () => clearInterval(i); }, [fetchData]);

  const items = data?.items || [];
  const totals = data?.totals;
  const platforms = data?.platforms || {};
  const distribution = data?.distribution || {};
  const weights = data?.weights;

  // Build lane summary items from totals (for LaneSummary component)
  const laneSummaryItems = totals ? [{
    lanes: {
      Reach: { current: totals.reach, velocity: totals.velocity.reach },
      Interest: { current: totals.interest, velocity: totals.velocity.interest },
      Engagement: { current: totals.engagement, velocity: totals.velocity.engagement },
    },
  }] : [];

  // Build platform stat cards from API platforms data
  const platformStatItems: StatCardItem[] = Object.entries(platforms).map(([platform, pData]) => {
    const name = capPlatform(platform);
    const platItems = items.filter(i => i.platform === platform);
    const dist = distribution[platform];
    return {
      id: 0,
      platform: name,
      display_name: `${name} — ${platItems.length} item${platItems.length !== 1 ? 's' : ''}`,
      tags: [],
      lanes: {
        Reach: { current: pData.reach, history: [0,0,0,0,0,0,0], velocity: pData.velocity.reach },
        Interest: { current: pData.interest, history: [0,0,0,0,0,0,0], velocity: pData.velocity.interest },
        Engagement: { current: pData.engagement, history: [0,0,0,0,0,0,0], velocity: pData.velocity.engagement },
      },
      performanceScore: pData.performanceScore,
      distribution: dist,
      peaks: pData.peaks,
    };
  });

  // Build per-item stat cards for tag view
  const tagStatItems: StatCardItem[] = items.map(item => ({
    id: item.id,
    platform: capPlatform(item.platform),
    display_name: item.display_name,
    tags: item.tags,
    lanes: {
      Reach: { current: item.reach, history: item.reachHistory, velocity: item.velocity.reach },
      Interest: { current: item.interest, history: item.interestHistory, velocity: item.velocity.interest },
      Engagement: { current: item.engagement, history: item.engagementHistory, velocity: item.velocity.engagement },
    },
    performanceScore: item.performanceScore,
  }));

  const showingTagged = activeTag !== 'All';

  return (
    <div>
      {/* Row 1: Title + time toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>All Metrics</h1>
        </div>
        <div style={{ display: 'flex', background: C.bgInput, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map(range => (
            <button key={range} onClick={() => setTimeRange(range)} style={{
              padding: '5px 12px', background: timeRange === range ? C.accent : 'transparent',
              border: 'none', color: timeRange === range ? '#fff' : C.textMid,
              fontSize: 10, fontWeight: timeRange === range ? 700 : 400,
              cursor: 'pointer', fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{range}</button>
          ))}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `3px solid ${C.borderMid}`, margin: '10px 0' }} />

      {/* Row 2: Tag selector */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: font }}>Tag</span>
        <select value={activeTag} onChange={e => setActiveTag(e.target.value)} style={{
          padding: '5px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 7, color: C.text, fontSize: 12, fontFamily: font, cursor: 'pointer', outline: 'none',
        }}>
          <option value="All">All</option>
          {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#991b1b', fontFamily: font }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          {/* Lane summary — always show platform-level data */}
          {laneSummaryItems.length > 0 && (
            <LaneSummary
              items={laneSummaryItems}
              performanceScore={totals?.performanceScore}
              performanceVelocity={totals?.performanceVelocity}
              weights={weights}
              activeCard={activeChart}
              onCardClick={(lane) => setActiveChart(prev => prev === lane ? null : lane)}
              timeLabel={formatPeriodLabel(timeRange, Object.values(data?.platforms || {})[0]?.periodStart, Object.values(data?.platforms || {})[0]?.periodEnd)}
              peaks={totals?.peaks}
            />
          )}

          {/* Lane chart — use items if available, otherwise build from platform history */}
          {(() => {
            const defaultHistory = new Array(timeRange === 'hourly' ? 24 : 7).fill(0);
            const chartItems = items.length > 0 ? items : Object.entries(data?.platforms || {}).map(([p, d]: [string, any]) => ({
              platform: p,
              reachHistory: d.reachHistory || [...defaultHistory],
              interestHistory: d.interestHistory || [...defaultHistory],
              engagementHistory: d.engagementHistory || [...defaultHistory],
              performanceHistory: d.performanceHistory || [...defaultHistory],
            }));
            return chartItems.length > 0 ? (
              <div style={{ marginTop: 12, marginBottom: 16 }}>
                <LayeredInterestChart
                  items={chartItems}
                  lane={activeChart || 'all'}
                  tag={activeTag !== 'All' ? activeTag : undefined}
                  range={timeRange}
                  events={events}
                />
              </div>
            ) : null;
          })()}

          {/* Platform stat cards (always) or tagged item cards (when tag selected) */}
          <div style={{ display: 'grid', gridTemplateColumns: showingTagged ? 'repeat(auto-fill, minmax(360px, 1fr))' : `repeat(${Math.min(platformStatItems.length, 3)}, 1fr)`, gap: 14 }}>
            {showingTagged
              ? tagStatItems.length > 0
                ? tagStatItems.map((item, i) => (
                    <StatCard key={item.id} item={item} index={i} />
                  ))
                : <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: C.textSoft, fontSize: 13, fontFamily: font }}>No items tagged "{activeTag}" yet.</div>
              : platformStatItems.map((item, i) => (
                  <StatCard key={item.platform} item={item} index={i} onClick={() => navigate(`/platform/${item.platform.toLowerCase()}`)} />
                ))
            }
          </div>
        </>
      )}
    </div>
  );
}
