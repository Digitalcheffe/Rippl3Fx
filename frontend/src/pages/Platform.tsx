import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C } from '../theme';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client';
import EmptyState from '../components/EmptyState';
import TagChip from '../components/TagChip';
import DiscoveryPanel from '../components/DiscoveryPanel';
import AccountStats from '../components/AccountStats';

const font = "'DM Mono', monospace";

const PLATFORM_NAMES: Record<string, string> = {
  reddit: 'Reddit', github: 'GitHub', ga4: 'GA4', bing: 'Bing',
};

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

  // Load accounts for this platform
  useEffect(() => {
    setLoading(true);
    apiGet<Account[]>('/accounts').then(all => {
      const filtered = all.filter(a => a.platform === platform);
      setAccounts(filtered);
      if (filtered.length > 0) setActiveAccountId(filtered[0].id);
      else setActiveAccountId(null);
      setLoading(false);
    }).catch(() => setLoading(false));
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

  // Load all tags for add-item tag select
  useEffect(() => {
    apiGet<Tag[]>('/tags').then(setAllTags).catch(() => {});
  }, []);

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

  const handleToggleActive = async (item: TrackedItem) => {
    await apiPut(`/items/${item.id}`, { is_active: item.is_active ? 0 : 1 });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: i.is_active ? 0 : 1 } : i));
  };

  const handleRemoveItem = async (id: number) => {
    if (!confirm('Remove this tracked item?')) return;
    await apiDelete(`/items/${id}`);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleRemoveTag = async (itemId: number, tagId: number) => {
    await apiDelete(`/tags/items/${itemId}/tags/${tagId}`);
    setItemTags(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter(t => t.id !== tagId),
    }));
  };

  if (loading) return null;

  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', marginBottom: 5, fontFamily: font }}>Platform</div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: -0.5, fontFamily: font }}>{name}</h1>

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

          {/* Account Overview */}
          {activeAccountId && <AccountStats accountId={activeAccountId} platform={name} />}

          {/* Discovery Panel */}
          {activeAccountId && (
            <DiscoveryPanel
              accountId={activeAccountId}
              platform={name}
              onItemTracked={() => {
                if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
              }}
            />
          )}

          {/* Tracked items header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: C.textFaint, textTransform: 'uppercase', fontFamily: font }}>Tracked Items</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePollNow} disabled={polling} style={{
                padding: '4px 12px', background: C.up + '15',
                border: `1px solid ${C.up}40`, borderRadius: 5,
                color: C.up, fontSize: 11, fontWeight: 700,
                cursor: polling ? 'wait' : 'pointer', fontFamily: font,
                opacity: polling ? 0.6 : 1,
              }}>
                {polling ? 'Polling...' : 'Poll Now'}
              </button>
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

          {/* Items list */}
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textSoft, fontSize: 13, fontFamily: font }}>
              No tracked items yet. Click "+ Add Item" to start tracking.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(item => (
                <div key={item.id} style={{
                  background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: '12px 14px', opacity: item.is_active ? 1 : 0.5,
                }}>
                  {editingItem?.id === item.id ? (
                    <EditItemForm
                      item={item}
                      onSaved={() => {
                        setEditingItem(null);
                        if (activeAccountId) apiGet<TrackedItem[]>(`/items/by-account/${activeAccountId}`).then(setItems);
                      }}
                      onCancel={() => setEditingItem(null)}
                    />
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.text, fontWeight: 600, fontFamily: font }}>{item.display_name}</div>
                        <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, marginTop: 2 }}>{item.platform_identifier}</div>
                        {(itemTags[item.id] || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                            {(itemTags[item.id] || []).map(tag => (
                              <TagChip key={tag.id} name={tag.name} onRemove={() => handleRemoveTag(item.id, tag.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => setEditingItem(item)} style={{
                          padding: '4px 10px', background: 'none',
                          border: `1px solid ${C.border}`, borderRadius: 5,
                          color: C.textMid, fontSize: 10, cursor: 'pointer', fontFamily: font,
                        }}>Edit</button>
                        <button onClick={() => handleToggleActive(item)} style={{
                          padding: '4px 10px', background: 'none',
                          border: `1px solid ${item.is_active ? C.up + '55' : C.border}`,
                          borderRadius: 5, color: item.is_active ? C.up : C.textFaint,
                          fontSize: 10, cursor: 'pointer', fontFamily: font,
                        }}>
                          {item.is_active ? 'Active' : 'Paused'}
                        </button>
                        <button onClick={() => handleRemoveItem(item.id)} style={{
                          padding: '4px 10px', background: 'none',
                          border: '1px solid #e8380d55', borderRadius: 5,
                          color: '#e8380d', fontSize: 10, cursor: 'pointer', fontFamily: font,
                        }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit Item Form ──
function EditItemForm({ item, onSaved, onCancel }: { item: TrackedItem; onSaved: () => void; onCancel: () => void }) {
  const [identifier, setIdentifier] = useState(item.platform_identifier);
  const [displayName, setDisplayName] = useState(item.display_name);
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
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
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
  reddit: 'https://reddit.com/r/subreddit/comments/...',
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
