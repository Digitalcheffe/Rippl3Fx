import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C } from '../theme';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client';
import EmptyState from '../components/EmptyState';
// TagChip used via StatCard
import DiscoveryPanel from '../components/DiscoveryPanel';
import AccountStats from '../components/AccountStats';
import LaneSummary from '../components/LaneSummary';
import LayeredInterestChart, { type ChartEvent } from '../components/LayeredInterestChart';
import StatCard, { type StatCardItem } from '../components/StatCard';
import { LaneInfoButton, LaneInfoPanel } from '../components/LaneInfo';

const font = "'DM Mono', monospace";

const PLATFORM_NAMES: Record<string, string> = {
  github: 'GitHub', ga4: 'GA4', bing: 'Bing',
};

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

interface Account {
  id: number;
  platform: string;
  display_name: string;
  polling_interval_min: number;
  is_active: number;
}

interface TrackedItem {
  id: number;
  metric_account_id: number;
  platform_identifier: string;
  display_name: string;
  is_active: number;
}

interface Tag {
  id: number;
  name: string;
}

/** Map a dashboard API item (with reach/interest/engagement directly) to StatCard lanes. */
function itemToLanes(item: any): Record<string, { current: number; history: number[]; velocity: number }> {
  const v = item.velocity || { reach: 0, interest: 0, engagement: 0 };
  return {
    Reach: { current: item.reach ?? 0, history: item.reachHistory || [0,0,0,0,0,0,0], velocity: v.reach },
    Interest: { current: item.interest ?? 0, history: item.interestHistory || [0,0,0,0,0,0,0], velocity: v.interest },
    Engagement: { current: item.engagement ?? 0, history: item.engagementHistory || [0,0,0,0,0,0,0], velocity: v.engagement },
  };
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: C.bgInput,
  border: `1px solid ${C.border}`, borderRadius: 7, color: C.text,
  fontSize: 13, fontFamily: font, boxSizing: 'border-box', outline: 'none',
};

export default function Platform() {
  const { platform } = useParams<{ platform: string }>();
  const name = PLATFORM_NAMES[platform || ''] || platform || 'Unknown';
  const platformColor = (C[name as keyof typeof C] || C.accent) as string;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [itemTags, setItemTags] = useState<Record<number, Tag[]>>({});
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<TrackedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardItems, setDashboardItems] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [activeTag, setActiveTag] = useState('All');
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [events, setEvents] = useState<ChartEvent[]>([]);

  useEffect(() => { apiGet<ChartEvent[]>('/events').then(setEvents).catch(() => {}); }, []);

  // Load accounts for this platform
  useEffect(() => {
    setLoading(true);
    apiGet<Account[]>('/accounts').then(all => {
      const filtered = all.filter(a => a.platform === platform);
      setAccounts(filtered);
      if (filtered.length > 0) setActiveAccountId(filtered[0].id);
      else setActiveAccountId(null);
      setLoading(false);
    }).catch(() => { setError('Failed to load accounts'); setLoading(false); });
  }, [platform]);

  // Load items when active account changes
  useEffect(() => {
    if (!activeAccountId) { setItems([]); return; }
    apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems).catch(() => setItems([]));
  }, [activeAccountId]);

  // Load tags for each item
  useEffect(() => {
    if (items.length === 0) { setItemTags({}); return; }
    Promise.all(items.map(async item => {
      const tags = await apiGet<Tag[]>(`/tags/items/${item.id}/tags`).catch(() => []);
      return { id: item.id, tags };
    })).then(results => {
      const map: Record<number, Tag[]> = {};
      results.forEach(r => { map[r.id] = r.tags; });
      setItemTags(map);
    });
  }, [items]);

  // Load dashboard data — always fetch platform-level, plus tag-filtered when tag selected
  const [platformData, setPlatformData] = useState<any>(null);
  const [tagData, setTagData] = useState<any>(null);
  const [tagDashboardItems, setTagDashboardItems] = useState<any[]>([]);
  useEffect(() => {
    // Always fetch unfiltered platform data
    const params = new URLSearchParams();
    params.set('range', timeRange);
    apiGet<{ items: any[]; platforms: Record<string, any> }>(`/dashboard?${params}`)
      .then(data => {
        setDashboardItems(data.items.filter(i => i.platform === platform));
        setPlatformData(data.platforms?.[platform || ''] || null);
      })
      .catch(() => {});

    // Fetch tag-filtered data when a tag is selected
    if (activeTag !== 'All') {
      const tagParams = new URLSearchParams();
      tagParams.set('range', timeRange);
      tagParams.set('tag', activeTag);
      apiGet<{ items: any[]; platforms: Record<string, any> }>(`/dashboard?${tagParams}`)
        .then(data => {
          setTagDashboardItems(data.items.filter(i => i.platform === platform));
          setTagData(data.platforms?.[platform || ''] || null);
        })
        .catch(() => {});
    } else {
      setTagData(null);
      setTagDashboardItems([]);
    }
  }, [platform, items, timeRange, activeTag]);

  // Load all tags for add-item tag select
  useEffect(() => {
    apiGet<Tag[]>('/tags').then(setAllTags).catch(() => {});
  }, []);

  // Lane summary from platform-level unified_metrics
  const laneSummaryItems = platformData ? [{
    lanes: {
      Reach: { current: platformData.reach ?? 0, velocity: platformData.velocity?.reach ?? 0 },
      Interest: { current: platformData.interest ?? 0, velocity: platformData.velocity?.interest ?? 0 },
      Engagement: { current: platformData.engagement ?? 0, velocity: platformData.velocity?.engagement ?? 0 },
    },
  }] : [];

  // Lane summary from tag-filtered data (when a tag is selected)
  const tagLaneSummaryItems = tagData ? [{
    lanes: {
      Reach: { current: tagData.reach ?? 0, velocity: tagData.velocity?.reach ?? 0 },
      Interest: { current: tagData.interest ?? 0, velocity: tagData.velocity?.interest ?? 0 },
      Engagement: { current: tagData.engagement ?? 0, velocity: tagData.velocity?.engagement ?? 0 },
    },
  }] : [];

  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);

  const handlePollNow = async () => {
    if (!activeAccountId || polling) return;
    setPolling(true);
    setPollResult(null);
    try {
      const result = await apiPost<{ success: boolean; results: Array<{ item: string; success: boolean }> }>(`/accounts/${activeAccountId}/poll-now`);
      const failed = result.results.filter(r => !r.success);
      if (failed.length === 0) {
        setPollResult('All items polled successfully');
      } else {
        setPollResult(`${failed.length} item(s) failed to poll`);
      }
    } catch (err: any) {
      setPollResult(err.message);
    } finally {
      setPolling(false);
      // Refresh items
      if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
    }
  };

  const handleUntrack = async (id: number) => {
    await apiPost(`/items/${id}/untrack`);
    if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
  };

  const handleRetrack = async (id: number) => {
    await apiPost(`/items/${id}/retrack`, {});
    if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
  };

  const [showUntracked, setShowUntracked] = useState(false);

  // Tag removal handled via tag management UI
  void itemTags; // used in StatCard rendering

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: C.textSoft, fontFamily: font, fontSize: 13 }}>Loading...</div>
  );

  return (
    <div>
      {/* Row 1: Platform name + time toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Platform</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>{name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 2, background: C.bgInput, borderRadius: 8, padding: 2 }}>
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map(range => (
            <button key={range} onClick={() => setTimeRange(range)} style={{
              padding: '5px 12px', background: timeRange === range ? C.accent : 'transparent',
              border: 'none', color: timeRange === range ? '#fff' : C.textMid,
              fontSize: 10, fontWeight: timeRange === range ? 700 : 400,
              borderRadius: 6, cursor: 'pointer', fontFamily: font, textTransform: 'uppercase',
            }}>{range}</button>
          ))}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: `3px solid ${C.borderMid}`, margin: '10px 0' }} />

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#991b1b', fontFamily: font }}>
          {error}
        </div>
      )}

      {/* Row 2: Tag selector + Poll Now + Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {allTags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8 }}>Tag</span>
              <select value={activeTag} onChange={e => setActiveTag(e.target.value)} style={{
                padding: '5px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
                borderRadius: 7, color: C.text, fontSize: 12, fontFamily: font, cursor: 'pointer', outline: 'none',
              }}>
                <option value="All">All</option>
                {allTags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeAccountId && (
            <button onClick={() => setShowDiscovery(true)} style={{
              padding: '5px 12px', background: platformColor + '15',
              border: `1px solid ${platformColor}40`, borderRadius: 6,
              color: platformColor, fontSize: 10, fontWeight: 700,
              cursor: 'pointer', fontFamily: font, textTransform: 'uppercase',
            }}>Browse</button>
          )}
          <button onClick={handlePollNow} disabled={polling} style={{
            padding: '5px 12px', background: C.up + '15',
            border: `1px solid ${C.up}55`, borderRadius: 6,
            color: C.up, fontSize: 10, fontWeight: 700,
            cursor: polling ? 'wait' : 'pointer', fontFamily: font,
            opacity: polling ? 0.6 : 1, textTransform: 'uppercase',
          }}>
            {polling ? 'Polling...' : 'Poll Now'}
          </button>
          <LaneInfoButton onClick={() => setShowInfo(!showInfo)} />
        </div>
      </div>

      {/* Discovery modal */}
      {showDiscovery && activeAccountId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,53,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: 14, width: 560, maxHeight: '80vh', overflow: 'auto', padding: 22, boxShadow: '0 24px 64px rgba(13,31,53,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: font }}>Discoverable Content</span>
              <button onClick={() => setShowDiscovery(false)} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 18, cursor: 'pointer' }}>x</button>
            </div>
            <DiscoveryPanel
              accountId={activeAccountId}
              platform={name}
              autoExpand
              onItemTracked={() => {
                if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
              }}
            />
          </div>
        </div>
      )}

      {showInfo && <LaneInfoPanel platform={name} onClose={() => setShowInfo(false)} />}

      {accounts.length === 0 ? (
        <EmptyState platform={name} />
      ) : (
        <div style={{ marginTop: 20 }}>
          {/* Account tabs */}
          {accounts.length > 1 && (
            <div style={{ display: 'flex', gap: 1, marginBottom: 16 }}>
              {accounts.map(a => (
                <button key={a.id} onClick={() => setActiveAccountId(a.id)} style={{
                  padding: '6px 14px', background: activeAccountId === a.id ? platformColor + '18' : 'none',
                  border: `1px solid ${activeAccountId === a.id ? platformColor + '40' : C.border}`,
                  borderRadius: 6, color: activeAccountId === a.id ? platformColor : C.textMid,
                  fontSize: 11, fontWeight: activeAccountId === a.id ? 700 : 400,
                  cursor: 'pointer', fontFamily: font,
                }}>
                  {a.display_name}
                </button>
              ))}
            </div>
          )}

          {/* Lanes + all three charts always visible */}
          {(() => {
            const isTagged = activeTag !== 'All';
            const activeLanes = isTagged ? tagLaneSummaryItems : laneSummaryItems;
            const activeData = isTagged ? tagData : platformData;
            const activeItems = isTagged ? tagDashboardItems : dashboardItems;
            const label = isTagged
              ? `#${activeTag} on ${name}`
              : undefined;

            if (activeLanes.length === 0) return null;

            const chartItems = activeItems.length > 0 ? activeItems : (activeData ? [{
              platform: platform,
              reachHistory: activeData.reachHistory || [0,0,0,0,0,0,0],
              interestHistory: activeData.interestHistory || [0,0,0,0,0,0,0],
              engagementHistory: activeData.engagementHistory || [0,0,0,0,0,0,0],
              performanceHistory: activeData.performanceHistory || [0,0,0,0,0,0,0],
            }] : []);

            return (
              <>
                {label && (
                  <div style={{ fontSize: 10, letterSpacing: 2, color: C.accent, textTransform: 'uppercase', fontFamily: font, marginBottom: 8 }}>
                    {label}
                  </div>
                )}
                <LaneSummary
                  items={activeLanes}
                  performanceScore={activeData?.performanceScore}
                  performanceVelocity={activeData?.performanceVelocity}
                  activeCard={activeChart}
                  onCardClick={(lane) => setActiveChart(prev => prev === lane ? null : lane)}
                  timeLabel={formatPeriodLabel(timeRange, activeData?.periodStart, activeData?.periodEnd)}
                  platform={platform}
                  peaks={activeData?.peaks}
                />
                {chartItems.length > 0 && (
                  <div style={{ marginTop: 12, marginBottom: 16 }}>
                    <LayeredInterestChart items={chartItems} lane={activeChart || 'all'} range={timeRange} events={events} />
                  </div>
                )}
              </>
            );
          })()}

          {/* Two-column layout: content left, account overview right */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
            {/* Left column: tracked items + discoverable */}
            <div>

          {/* Tracked items header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', fontFamily: font }}>Tracked Items</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAddItem(!showAddItem)} style={{
                padding: '4px 12px', background: platformColor + '15',
                border: `1px solid ${platformColor}40`, borderRadius: 5,
                color: platformColor, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: font,
              }}>
                {showAddItem ? 'Cancel' : '+ Add Item'}
              </button>
            </div>
          </div>
          {pollResult && (
            <div style={{ fontSize: 11, color: pollResult.includes('success') ? C.up : '#c00', fontFamily: font, marginBottom: 8 }}>
              {pollResult}
            </div>
          )}

          {/* Add item form */}
          {showAddItem && activeAccountId && (
            <AddItemForm
              accountId={activeAccountId}
              platform={platform || 'github'}
              allTags={allTags}
              onAdded={() => {
                setShowAddItem(false);
                apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
              }}
            />
          )}

          {/* Tracked items */}
          {(() => {
            const allTracked = items.filter(i => i.is_active);
            const trackedItems = activeTag !== 'All'
              ? allTracked.filter(i => (itemTags[i.id] || []).some(t => t.name === activeTag))
              : allTracked;
            const untrackedItems = items.filter(i => !i.is_active);

            const renderItem = (item: TrackedItem, i: number, isTracked: boolean) => {
              const dashItem = dashboardItems.find(d => d.id === item.id);
              const statItem: StatCardItem = {
                id: item.id,
                platform: name,
                display_name: item.display_name,
                tags: (itemTags[item.id] || []).map(t => t.name),
                lanes: dashItem ? itemToLanes(dashItem) : {
                  Reach: { current: 0, history: [0,0,0,0,0,0,0], velocity: 0 },
                  Interest: { current: 0, history: [0,0,0,0,0,0,0], velocity: 0 },
                  Engagement: { current: 0, history: [0,0,0,0,0,0,0], velocity: 0 },
                },
                performanceScore: dashItem?.performanceScore,
              };

              return (
                <div key={item.id} style={{ opacity: isTracked ? 1 : 0.5 }}>
                  {editingItem?.id === item.id ? (
                    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
                      <EditItemForm
                        item={item}
                        allTags={allTags}
                        currentTagIds={(itemTags[item.id] || []).map(t => t.id)}
                        onSaved={() => {
                          setEditingItem(null);
                          if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
                          Promise.all(items.map(async it => {
                            const tags = await apiGet<Tag[]>(`/tags/items/${it.id}/tags`).catch(() => []);
                            return { id: it.id, tags };
                          })).then(results => {
                            const map: Record<number, Tag[]> = {};
                            results.forEach(r => { map[r.id] = r.tags; });
                            setItemTags(map);
                          });
                          apiGet<Tag[]>('/tags').then(setAllTags).catch(() => {});
                        }}
                        onCancel={() => setEditingItem(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <StatCard item={statItem} index={i} />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingItem(item)} style={{
                          padding: '3px 8px', background: 'none', border: `1px solid ${C.border}`,
                          borderRadius: 4, color: C.textMid, fontSize: 9, cursor: 'pointer', fontFamily: font,
                        }}>Edit</button>
                        {isTracked ? (
                          <button onClick={() => handleUntrack(item.id)} style={{
                            padding: '3px 8px', background: 'none', border: `1px solid ${C.down}55`,
                            borderRadius: 4, color: C.down, fontSize: 9, cursor: 'pointer', fontFamily: font,
                          }}>Untrack</button>
                        ) : (
                          <button onClick={() => handleRetrack(item.id)} style={{
                            padding: '3px 8px', background: C.up + '15', border: `1px solid ${C.up}55`,
                            borderRadius: 4, color: C.up, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: font,
                          }}>Re-track</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            };

            return (
              <>
                {trackedItems.length === 0 && untrackedItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: C.textSoft, fontSize: 13, fontFamily: font }}>
                    No tracked items yet. Click "+ Add Item" to start tracking.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                      {trackedItems.map((item, i) => renderItem(item, i, true))}
                    </div>

                    {untrackedItems.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <button onClick={() => setShowUntracked(!showUntracked)} style={{
                          background: 'none', border: 'none', color: C.textFaint, fontSize: 10,
                          fontFamily: font, cursor: 'pointer', letterSpacing: 2, textTransform: 'uppercase',
                        }}>
                          Untracked ({untrackedItems.length}) {showUntracked ? '▲' : '▼'}
                        </button>
                        {showUntracked && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14, marginTop: 10 }}>
                            {untrackedItems.map((item, i) => renderItem(item, i, false))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            );
          })()}

              {/* Discovery Panel (modal, triggered from header) */}
            </div>

            {/* Right column: Account Overview */}
            <div>
              {activeAccountId && <AccountStats accountId={activeAccountId} platform={name} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit Item Form ──
function EditItemForm({ item, allTags, currentTagIds, onSaved, onCancel }: {
  item: TrackedItem; allTags: Tag[]; currentTagIds: number[]; onSaved: () => void; onCancel: () => void;
}) {
  const [identifier, setIdentifier] = useState(item.platform_identifier);
  const [displayName, setDisplayName] = useState(item.display_name);
  const [selectedTags, setSelectedTags] = useState<number[]>(currentTagIds);
  const [newTagName, setNewTagName] = useState('');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!identifier.trim()) { setError('Platform identifier is required'); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }
    try {
      await apiPut(`/items/${item.id}`, {
        platform_identifier: identifier.trim(),
        display_name: displayName.trim(),
      });

      // Sync tags: get current, remove removed, add added
      const currentTags = await apiGet<Tag[]>(`/tags/items/${item.id}/tags`).catch(() => []);
      const currentIds = currentTags.map(t => t.id);

      // Remove tags no longer selected
      for (const tagId of currentIds) {
        if (!selectedTags.includes(tagId)) {
          await apiDelete(`/tags/items/${item.id}/tags/${tagId}`).catch(() => {});
        }
      }
      // Add newly selected tags
      for (const tagId of selectedTags) {
        if (!currentIds.includes(tagId)) {
          await apiPost(`/tags/items/${item.id}/tags`, { tag_id: tagId }).catch(() => {});
        }
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await apiPost<Tag>('/tags', { name: newTagName.trim() });
      setSelectedTags(prev => [...prev, tag.id]);
      setNewTagName('');
    } catch { /* tag might already exist */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Platform Identifier</label>
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp} />
        </div>
      </div>

      {/* Tag management */}
      <div>
        <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Tags</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {allTags.map(tag => {
            const selected = selectedTags.includes(tag.id);
            return (
              <button key={tag.id} onClick={() => {
                setSelectedTags(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]);
              }} style={{
                padding: '3px 10px', borderRadius: 5, fontSize: 10, fontFamily: font, cursor: 'pointer',
                background: selected ? C.accent + '18' : 'transparent',
                border: `1px solid ${selected ? C.accent : C.border}`,
                color: selected ? C.accent : C.textMid, fontWeight: selected ? 700 : 400,
              }}>
                {tag.name}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="New tag..." onKeyDown={e => e.key === 'Enter' && handleAddTag()}
            style={{ ...inp, flex: 1, padding: '4px 8px', fontSize: 10 }} />
          <button onClick={handleAddTag} style={{ padding: '4px 10px', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMid, fontSize: 10, cursor: 'pointer', fontFamily: font }}>Add</button>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} style={{ padding: '5px 14px', background: C.accent, border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: font }}>Save</button>
        <button onClick={onCancel} style={{ padding: '5px 14px', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 6, color: C.textMid, fontSize: 11, cursor: 'pointer', fontFamily: font }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Add Item Form ──
const IDENTIFIER_HINTS: Record<string, string> = {
  github: 'owner/repo (e.g. Digitalcheffe/N.O.R.A)',
  ga4: 'Page path (e.g. /blog/my-post)',
  bing: 'Page URL (e.g. https://yoursite.com/page)',
};

function AddItemForm({ accountId, platform, allTags, onAdded }: { accountId: number; platform: string; allTags: Tag[]; onAdded: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!identifier.trim()) { setError('Platform identifier is required'); return; }
    if (!displayName.trim()) { setError('Display name is required'); return; }

    try {
      const item = await apiPost<TrackedItem>('/items', {
        metric_account_id: accountId,
        platform_identifier: identifier.trim(),
        display_name: displayName.trim(),
      });

      // Assign selected tags
      for (const tagId of selectedTags) {
        await apiPost(`/tags/items/${item.id}/tags`, { tag_id: tagId }).catch(() => {});
      }

      onAdded();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Platform Identifier</label>
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} style={inp} placeholder={IDENTIFIER_HINTS[platform] || 'identifier'} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={inp} placeholder="My Project" />
        </div>
      </div>

      {allTags.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Tags</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allTags.map(tag => {
              const selected = selectedTags.includes(tag.id);
              return (
                <button key={tag.id} onClick={() => {
                  setSelectedTags(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id]);
                }} style={{
                  padding: '3px 10px', borderRadius: 5, fontSize: 10, fontFamily: font, cursor: 'pointer',
                  background: selected ? C.accent + '18' : 'transparent',
                  border: `1px solid ${selected ? C.accent : C.border}`,
                  color: selected ? C.accent : C.textMid, fontWeight: selected ? 700 : 400,
                }}>
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font, marginBottom: 8 }}>{error}</div>}

      <button onClick={handleSubmit} style={{
        padding: '6px 16px', background: C.accent, border: 'none', borderRadius: 7,
        color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: font,
      }}>Add Item</button>
    </div>
  );
}
