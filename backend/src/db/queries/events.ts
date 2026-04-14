import db from '../connection';
import { Tag } from './tags';

export interface Event {
  id: number;
  name: string;
  description: string | null;
  event_date: string;
  event_url: string | null;
  created_at: string;
  updated_at: string;
}

export function getAllEvents(): Event[] {
  return db.prepare('SELECT * FROM events ORDER BY event_date DESC').all() as Event[];
}

export function getEventById(id: number): Event | undefined {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event | undefined;
}

export function createEvent(
  name: string,
  event_date: string,
  description?: string,
  event_url?: string
): Event {
  const result = db.prepare(
    'INSERT INTO events (name, description, event_date, event_url) VALUES (?, ?, ?, ?)'
  ).run(name, description ?? null, event_date, event_url ?? null);
  return getEventById(result.lastInsertRowid as number)!;
}

export function updateEvent(
  id: number,
  fields: Partial<Pick<Event, 'name' | 'description' | 'event_date' | 'event_url'>>
): Event | undefined {
  const current = getEventById(id);
  if (!current) return undefined;

  const updated = {
    name: fields.name ?? current.name,
    description: fields.description ?? current.description,
    event_date: fields.event_date ?? current.event_date,
    event_url: fields.event_url ?? current.event_url,
  };

  db.prepare(`
    UPDATE events
    SET name = ?, description = ?, event_date = ?, event_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(updated.name, updated.description, updated.event_date, updated.event_url, id);

  return getEventById(id);
}

export function deleteEvent(id: number): boolean {
  db.prepare('DELETE FROM event_tags WHERE event_id = ?').run(id);
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getTagsForEvent(eventId: number): Tag[] {
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN event_tags et ON et.tag_id = t.id
    WHERE et.event_id = ?
    ORDER BY t.name
  `).all(eventId) as Tag[];
}

export function getEventsForTag(tagId: number): Event[] {
  return db.prepare(`
    SELECT e.* FROM events e
    JOIN event_tags et ON et.event_id = e.id
    WHERE et.tag_id = ?
    ORDER BY e.event_date DESC
  `).all(tagId) as Event[];
}

export function assignTagToEvent(eventId: number, tagId: number): boolean {
  try {
    db.prepare('INSERT INTO event_tags (event_id, tag_id) VALUES (?, ?)').run(eventId, tagId);
    return true;
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return false;
    throw err;
  }
}

export function removeTagFromEvent(eventId: number, tagId: number): boolean {
  const result = db.prepare('DELETE FROM event_tags WHERE event_id = ? AND tag_id = ?').run(eventId, tagId);
  return result.changes > 0;
}

export function getEventsInDateRange(start: string, end: string): Event[] {
  return db.prepare(
    'SELECT * FROM events WHERE event_date >= ? AND event_date <= ? ORDER BY event_date ASC'
  ).all(start, end) as Event[];
}
