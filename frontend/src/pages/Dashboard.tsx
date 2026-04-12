import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../theme';
import { apiGet } from '../api/client';
import LaneSummary from '../components/LaneSummary';
import PerformanceTrend from '../components/PerformanceTrend';
import LayeredInterestChart from '../components/LayeredInterestChart';
import StatCard, { type StatCardItem } from '../components/StatCard';
import SkeletonCard from '../components/SkeletonCard';

const font = "'DM Mono', monospace";

interface DashboardItem {
  id: number;
  platform: string;
  display_name: string;
  platform_identifier: string;
  tags: string[];
  latestSnapshot: Record<string, any> | null;
  interestHistory: number[];
  currentInterestScore: number;
  interestTrend: 'up' | 'down' | 'flat';
}

interface Tag {
  id: number;
  name: string;
}

// Map platform snapshot metrics to Reach/Interest/Engagement lanes
function mapToLanes(item: DashboardItem): Record<string, { current: number; history: number[]; velocity: number }> {
  const snap = item.latestSnapshot;
  if (!snap) {
    return {
      Reach: { current: 0, history: [0, 0, 0, 0, 0, 0, 0], velocity: 0 },
      Interest: { current: 0, history: item.interestHistory, velocity: 0 },
      Engagement: { current: 0, history: [0, 0, 0, 0, 0, 0, 0], velocity: 0 },
    };
  }

  switch (item.platform) {
    case 'github':
      return {
        Reach: { current: (snap.traffic_views || 0) + (snap.traffic_uniques || 0), history: item.interestHistory, velocity: 0 },
        Interest: { current: (snap.stars || 0) + (snap.forks || 0), history: item.interestHistory, velocity: 0 },
        Engagement: { current: (snap.clones || 0) + (snap.clones_uniques || 0), history: item.interestHistory, velocity: 0 },
      };
    case 'reddit':
      return {
        Reach: { current: snap.view_count || 0, history: item.interestHistory, velocity: 0 },
        Interest: { current: snap.upvotes || 0, history: item.interestHistory, velocity: 0 },
        Engagement: { current: snap.comment_count || 0, history: item.interestHistory, velocity: 0 },
      };
    case 'ga4':
      return {
        Reach: { current: snap.pageviews || 0, history: item.interestHistory, velocity: 0 },
        Interest: { current: snap.users || 0, history: item.interestHistory, velocity: 0 },
        Engagement: { current: snap.sessions || 0, history: item.interestHistory, velocity: 0 },
      };
    case 'bing':
      return {
        Reach: { current: snap.impressions || 0, history: item.interestHistory, velocity: 0 },
        Interest: { current: snap.clicks || 0, history: item.interestHistory, velocity: 0 },
        Engagement: { current: snap.ctr ? Math.round(snap.ctr * 1000) / 10 : 0, history: item.interestHistory, velocity: 0 },
      };
    default:
      return {
        Reach: { current: 0, history: item.interestHistory, velocity: 0 },
        Interest: { current: 0, history: item.interestHistory, velocity: 0 },
        Engagement: { current: 0, history: item.interestHistory, velocity: 0 },
      };
  }
}

function toStatCardItem(item: DashboardItem): StatCardItem {
  // Capitalize platform name for PlatformPill
  const platformName = item.platform === 'ga4' ? 'GA4'
    : item.platform.charAt(0).toUpperCase() + item.platform.slice(1);
  return {
    id: item.id,
    platform: platformName,
    display_name: item.display_name,
    tags: item.tags,
    lanes: mapToLanes(item),
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTag, setActiveTag] = useState('All');
  const [timeRange, setTimeRange] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTag !== 'All') params.set('tag', activeTag);
      params.set('range', timeRange);
      const data = await apiGet<{ items: DashboardItem[] }>(`/dashboard?${params}`);
      setItems(data.items);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeTag, timeRange]);

  useEffect(() => {
    apiGet<Tag[]>('/tags').then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const statItems = items.map(toStatCardItem);

  // Group items by platform for platform-level view
  const platformGroups: Record<string, DashboardItem[]> = {};
  for (const item of items) {
    const name = item.platform === 'ga4' ? 'GA4' : item.platform.charAt(0).toUpperCase() + item.platform.slice(1);
    if (!platformGroups[name]) platformGroups[name] = [];
    platformGroups[name].push(item);
  }

  // Create platform-level stat cards (aggregate all items per platform)
  const platformStatItems: StatCardItem[] = Object.entries(platformGroups).map(([platform, platformItems]) => {
    const lanes: Record<string, { current: number; history: number[]; velocity: number }> = {
      Reach: { current: 0, history: [0, 0, 0, 0, 0, 0, 0], velocity: 0 },
      Interest: { current: 0, history: [0, 0, 0, 0, 0, 0, 0], velocity: 0 },
      Engagement: { current: 0, history: [0, 0, 0, 0, 0, 0, 0], velocity: 0 },
    };
    for (const item of platformItems) {
      const itemLanes = mapToLanes(item);
      for (const lane of ['Reach', 'Interest', 'Engagement']) {
        lanes[lane].current += itemLanes[lane]?.current || 0;
        lanes[lane].velocity += itemLanes[lane]?.velocity || 0;
        for (let i = 0; i < 7; i++) {
          lanes[lane].history[i] += itemLanes[lane]?.history[i] || 0;
        }
      }
    }
    return {
      id: 0,
      platform,
      display_name: `${platform} — ${platformItems.length} item${platformItems.length > 1 ? 's' : ''}`,
      tags: [],
      lanes,
    };
  });

  const showingTagged = activeTag !== 'All';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Dashboard</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>All Metrics</h1>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* Tag filter */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: C.textFaint, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: font }}>Tag</span>
            <select
              value={activeTag}
              onChange={e => setActiveTag(e.target.value)}
              style={{
                padding: '5px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
                borderRadius: 7, color: C.text, fontSize: 12, fontFamily: font,
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="All">All</option>
              {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>

          {/* Time range pills */}
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
      </div>

      {loading ? (
        /* Skeleton loading */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : items.length === 0 ? (
        /* Empty state */
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.textSoft, fontSize: 13, fontFamily: font }}>
          {activeTag === 'All' ? (
            <>
              No tracked items yet.{' '}
              <span onClick={() => navigate('/settings')} style={{ color: C.accent, cursor: 'pointer', textDecoration: 'underline' }}>
                Add some in Settings
              </span>.
            </>
          ) : (
            <>No items tagged "{activeTag}" yet.</>
          )}
        </div>
      ) : (
        <>
          {/* Lane summary */}
          <LaneSummary items={statItems} />

          {/* Performance trend */}
          <PerformanceTrend items={items} />

          {/* Layered interest chart */}
          <LayeredInterestChart items={items} tag={activeTag !== 'All' ? activeTag : undefined} />

          {/* Stat cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
            {showingTagged
              ? statItems.map((item, i) => (
                  <StatCard key={item.id} item={item} index={i} />
                ))
              : platformStatItems.map((item, i) => (
                  <StatCard key={item.platform} item={item} index={i} />
                ))
            }
          </div>
        </>
      )}
    </div>
  );
}
