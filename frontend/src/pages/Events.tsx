import { useState, useEffect, useCallback } from 'react';
import { C } from '../theme';
import { apiGet, apiPost, apiPut, apiDelete } from '../api/client';

const font = "'DM Mono', monospace";

interface Tag { id: number; name: string; }

interface EventItem {
  id: number;
  name: string;
  description: string | null;
  event_date: string;
  event_url: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: C.bgInput,
  border: `1px solid ${C.border}`, borderRadius: 7, color: C.text,
  fontSize: 13, fontFamily: font, boxSizing: 'border-box', outline: 'none',
};

const btn: React.CSSProperties = {
  padding: '8px 18px', border: 'none', borderRadius: 7,
  fontSize: 12, fontWeight: 700, fontFamily: font,
  cursor: 'pointer', letterSpacing: 0.3,
};

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function Events() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTagIds, setFormTagIds] = useState<number[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await apiGet<EventItem[]>('/events');
      // Fetch tags for each event (list endpoint doesn't include them)
      const withTags = await Promise.all(
        data.map(async (e) => {
          try {
            const full = await apiGet<EventItem>(`/events/${e.id}`);
            return full;
          } catch { return { ...e, tags: [] }; }
        })
      );
      setEvents(withTags);
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try { setTags(await apiGet<Tag[]>('/tags')); }
    catch (err) { console.error('Failed to load tags', err); }
  }, []);

  useEffect(() => { fetchEvents(); fetchTags(); }, [fetchEvents, fetchTags]);

  const resetForm = () => {
    setFormName(''); setFormDesc(''); setFormDate(''); setFormUrl('');
    setFormTagIds([]); setEditingId(null); setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!formName.trim() || !formDate) return;
    try {
      if (editingId) {
        await apiPut(`/events/${editingId}`, {
          name: formName.trim(), description: formDesc || null,
          event_date: formDate, event_url: formUrl || null,
        });
        // Sync tags: remove old, add new
        const current = events.find(e => e.id === editingId);
        const oldIds = current?.tags.map(t => t.id) || [];
        for (const id of oldIds) {
          if (!formTagIds.includes(id)) await apiDelete(`/events/${editingId}/tags/${id}`);
        }
        for (const id of formTagIds) {
          if (!oldIds.includes(id)) {
            try { await apiPost(`/events/${editingId}/tags`, { tag_id: id }); } catch {}
          }
        }
      } else {
        await apiPost('/events', {
          name: formName.trim(), description: formDesc || null,
          event_date: formDate, event_url: formUrl || null,
          tag_ids: formTagIds,
        });
      }
      resetForm();
      fetchEvents();
    } catch (err) { console.error('Failed to save event', err); }
  };

  const handleEdit = (e: EventItem) => {
    setEditingId(e.id);
    setFormName(e.name);
    setFormDesc(e.description || '');
    setFormDate(e.event_date.split('T')[0]);
    setFormUrl(e.event_url || '');
    setFormTagIds(e.tags.map(t => t.id));
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try { await apiDelete(`/events/${id}`); fetchEvents(); }
    catch (err) { console.error('Failed to delete event', err); }
  };

  const toggleTag = (tagId: number) => {
    setFormTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: 0.5, fontFamily: font, color: C.text }}>
          Events
        </h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{ ...btn, background: C.accent, color: '#fff' }}
        >
          + New Event
        </button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: C.textSoft, fontFamily: font }}>
        Mark moments that create ripples. Events appear as markers on your charts.
      </p>
      <hr style={{ border: 'none', borderTop: `2px solid ${C.border}`, margin: '0 0 20px' }} />

      {/* Create / Edit Form */}
      {showForm && (
        <div style={{
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
          padding: 20, marginBottom: 20,
        }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, fontFamily: font, color: C.text }}>
            {editingId ? 'Edit Event' : 'New Event'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: C.textSoft, fontFamily: font, marginBottom: 4, display: 'block' }}>Name *</label>
              <input style={inp} value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Published blog post" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textSoft, fontFamily: font, marginBottom: 4, display: 'block' }}>Date *</label>
              <input style={inp} type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.textSoft, fontFamily: font, marginBottom: 4, display: 'block' }}>Description</label>
            <input style={inp} value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="What happened?" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.textSoft, fontFamily: font, marginBottom: 4, display: 'block' }}>Link</label>
            <input style={inp} value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://..." />
          </div>

          {/* Tag selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: C.textSoft, fontFamily: font, marginBottom: 6, display: 'block' }}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.length === 0 && (
                <span style={{ fontSize: 11, color: C.textFaint, fontFamily: font }}>No tags yet — create tags from a platform page first</span>
              )}
              {tags.map(tag => {
                const selected = formTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    style={{
                      padding: '4px 10px', borderRadius: 12, fontSize: 11, fontFamily: font, fontWeight: 600,
                      border: selected ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                      background: selected ? C.accentSoft : C.bgInput,
                      color: selected ? C.accent : C.textMid,
                      cursor: 'pointer',
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSubmit} style={{ ...btn, background: C.accent, color: '#fff' }}>
              {editingId ? 'Save Changes' : 'Create Event'}
            </button>
            <button onClick={resetForm} style={{ ...btn, background: C.bgInput, color: C.textMid }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Events List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textSoft, fontFamily: font, fontSize: 13 }}>Loading events...</div>
      ) : events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <p style={{ fontSize: 14, color: C.textMid, fontFamily: font, margin: '0 0 8px', fontWeight: 600 }}>No events yet</p>
          <p style={{ fontSize: 12, color: C.textSoft, fontFamily: font, margin: 0 }}>
            Create your first event to mark a launch, release, or post.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(event => (
            <div key={event.id} style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
              transition: 'box-shadow 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(13,31,53,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              {/* Date badge */}
              <div style={{
                minWidth: 56, textAlign: 'center', padding: '6px 8px',
                background: C.accentSoft, borderRadius: 8,
              }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, fontFamily: font, lineHeight: 1 }}>
                  {new Date(event.event_date + (event.event_date.includes('T') ? '' : 'T12:00:00')).getDate()}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.accent, fontFamily: font, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date(event.event_date + (event.event_date.includes('T') ? '' : 'T12:00:00')).getMonth()]}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: font }}>
                    {event.name}
                  </span>
                  {event.event_url && (
                    <a href={event.event_url} target="_blank" rel="noopener noreferrer" style={{
                      fontSize: 10, color: C.textSoft, fontFamily: font, textDecoration: 'none',
                    }}>
                      [link]
                    </a>
                  )}
                </div>
                {event.description && (
                  <div style={{ fontSize: 12, color: C.textSoft, fontFamily: font, marginBottom: 4 }}>
                    {event.description}
                  </div>
                )}
                {event.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {event.tags.map(tag => (
                      <span key={tag.id} style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: C.accentSoft, color: C.accent, fontFamily: font,
                      }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleEdit(event)} style={{
                  ...btn, padding: '5px 12px', background: C.bgInput, color: C.textMid, fontSize: 11,
                }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(event.id)} style={{
                  ...btn, padding: '5px 12px', background: 'rgba(232,56,13,0.08)', color: C.down, fontSize: 11,
                }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
