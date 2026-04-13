import { useState, useEffect } from 'react';
import { C } from '../theme';
import { apiGet, apiPost } from '../api/client';

const font = "'DM Mono', monospace";

interface DiscoverableItem {
  name: string;
  identifier: string;
  already_tracked: boolean;
}

interface Tag {
  id: number;
  name: string;
}

interface DiscoveryPanelProps {
  accountId: number;
  platform: string;
  onItemTracked: () => void;
}

export default function DiscoveryPanel({ accountId, platform, onItemTracked }: DiscoveryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<DiscoverableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoItem, setInfoItem] = useState<string | null>(null);
  const [tagModalItem, setTagModalItem] = useState<DiscoverableItem | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [displayName, setDisplayName] = useState('');

  const platformColor = (C[platform as keyof typeof C] || C.accent) as string;

  const loadDiscoverable = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<DiscoverableItem[]>(`/accounts/${accountId}/discover`);
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (expanded && items.length === 0) loadDiscoverable();
  }, [expanded]);

  useEffect(() => {
    apiGet<Tag[]>('/tags').then(setAllTags).catch(() => {});
  }, []);

  const handleTagAndTrack = async (item: DiscoverableItem) => {
    try {
      const tracked = await apiPost<{ id: number }>('/items', {
        metric_account_id: accountId,
        platform_identifier: item.identifier,
        display_name: displayName || item.name,
      });

      for (const tagId of selectedTags) {
        await apiPost(`/tags/items/${tracked.id}/tags`, { tag_id: tagId }).catch(() => {});
      }

      setTagModalItem(null);
      setSelectedTags([]);
      setDisplayName('');
      // Mark as tracked in discovery list
      setItems(prev => prev.map(i =>
        i.identifier === item.identifier ? { ...i, already_tracked: true } : i
      ));
      onItemTracked();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(30,58,95,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: C.textMid, textTransform: 'uppercase', fontFamily: font }}>Discoverable Content</div>
        <button onClick={() => setExpanded(!expanded)} style={{
          padding: '4px 12px', background: platformColor + '18',
          border: `1px solid ${platformColor}40`, borderRadius: 6,
          color: platformColor, fontSize: 11, fontWeight: 700,
          cursor: 'pointer', fontFamily: font,
        }}>
          {expanded ? 'Hide' : 'Browse'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && <div style={{ fontSize: 12, color: C.textSoft, fontFamily: font }}>Loading...</div>}
          {error && <div style={{ fontSize: 12, color: '#c00', fontFamily: font }}>{error}</div>}

          {!loading && items.length === 0 && !error && (
            <div style={{ fontSize: 12, color: C.textSoft, fontFamily: font }}>
              No discoverable content found. You can add items manually using "+ Add Item" above.
            </div>
          )}

          {items.map(item => (
            <div key={item.identifier} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: C.bgSection, borderRadius: 8,
              border: `1px solid ${C.border}`,
              opacity: item.already_tracked ? 0.5 : 1,
            }}>
              <span style={{ fontSize: 12, color: C.text, fontFamily: font }}>{item.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {!item.already_tracked ? (
                  <>
                    <button onClick={() => setInfoItem(infoItem === item.identifier ? null : item.identifier)} style={{
                      padding: '4px 10px', background: 'none', border: `1px solid ${C.border}`,
                      borderRadius: 5, color: C.textMid, fontSize: 11, cursor: 'pointer', fontFamily: font,
                    }}>Get Info</button>
                    <button onClick={() => { setTagModalItem(item); setDisplayName(item.name); }} style={{
                      padding: '4px 10px', background: platformColor, border: 'none',
                      borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', fontFamily: font,
                    }}>Tag & Track</button>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: C.textFaint, fontFamily: font }}>Already tracked</span>
                )}
              </div>
            </div>
          ))}

          {infoItem && (
            <div style={{ padding: '12px 14px', background: C.bgSection, borderRadius: 8, border: `1px solid ${platformColor}40` }}>
              <div style={{ fontSize: 10, color: C.textFaint, fontFamily: font, marginBottom: 8 }}>Live snapshot preview</div>
              <div style={{ fontSize: 11, color: C.textSoft, fontFamily: font }}>
                Click "Tag & Track" to start long-term polling for this item.
              </div>
            </div>
          )}

          {/* Manual entry */}
          <ManualEntry platformColor={platformColor} onTrack={(identifier) => {
            setTagModalItem({ name: identifier, identifier, already_tracked: false });
            setDisplayName(identifier);
          }} />
        </div>
      )}

      {/* Tag & Track modal */}
      {tagModalItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,31,53,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.bgCard, border: `1px solid ${C.borderMid}`, borderRadius: 14, width: 400, padding: 22, boxShadow: '0 24px 64px rgba(13,31,53,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: font }}>Tag & Track</span>
              <button onClick={() => { setTagModalItem(null); setSelectedTags([]); }} style={{ background: 'none', border: 'none', color: C.textSoft, fontSize: 18, cursor: 'pointer' }}>x</button>
            </div>

            <div style={{ fontSize: 12, color: C.textMid, fontFamily: font, marginBottom: 14 }}>
              {tagModalItem.identifier}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} style={{
                width: '100%', padding: '8px 12px', background: C.bgInput, border: `1px solid ${C.border}`,
                borderRadius: 7, color: C.text, fontSize: 13, fontFamily: font, boxSizing: 'border-box', outline: 'none',
              }} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: C.textSoft, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 4 }}>Tags</label>
              {allTags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
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
                      }}>{tag.name}</button>
                    );
                  })}
                </div>
              )}
              <NewTagInput onCreated={(tag) => {
                setAllTags(prev => [...prev, tag]);
                setSelectedTags(prev => [...prev, tag.id]);
              }} />
            </div>

            <button onClick={() => handleTagAndTrack(tagModalItem)} style={{
              padding: '8px 20px', background: platformColor, border: 'none', borderRadius: 7,
              color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: font,
            }}>Track Item</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manual Entry ──
function ManualEntry({ platformColor, onTrack }: { platformColor: string; onTrack: (identifier: string) => void }) {
  const [value, setValue] = useState('');

  return (
    <div style={{ padding: '10px 12px', background: C.bgSection, borderRadius: 8, border: `1px dashed ${C.borderMid}`, display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Not listed? Enter identifier manually..."
        style={{
          flex: 1, padding: '6px 10px', background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 5, color: C.text, fontSize: 11, fontFamily: font, outline: 'none',
        }}
      />
      <button
        onClick={() => { if (value.trim()) { onTrack(value.trim()); setValue(''); } }}
        disabled={!value.trim()}
        style={{
          padding: '6px 12px', background: platformColor, border: 'none', borderRadius: 5,
          color: '#fff', fontSize: 11, fontWeight: 700, cursor: value.trim() ? 'pointer' : 'default',
          fontFamily: font, opacity: value.trim() ? 1 : 0.5,
        }}
      >
        Tag & Track
      </button>
    </div>
  );
}

// ── New Tag Input ──
function NewTagInput({ onCreated }: { onCreated: (tag: Tag) => void }) {
  const [value, setValue] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!value.trim() || creating) return;
    setCreating(true);
    try {
      const tag = await apiPost<Tag>('/tags', { name: value.trim() });
      onCreated(tag);
      setValue('');
    } catch { /* tag may already exist */ }
    setCreating(false);
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
        placeholder="Create new tag..."
        style={{
          flex: 1, padding: '5px 10px', background: C.bgInput, border: `1px solid ${C.border}`,
          borderRadius: 5, color: C.text, fontSize: 11, fontFamily: font, outline: 'none',
        }}
      />
      <button onClick={handleCreate} disabled={!value.trim() || creating} style={{
        padding: '5px 10px', background: C.accent, border: 'none', borderRadius: 5,
        color: '#fff', fontSize: 10, fontWeight: 700, cursor: value.trim() ? 'pointer' : 'default',
        fontFamily: font, opacity: value.trim() ? 1 : 0.5,
      }}>+ Tag</button>
    </div>
  );
}
