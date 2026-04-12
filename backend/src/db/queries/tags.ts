import db from '../connection';

export interface Tag {
  id: number;
  name: string;
}

export function getAllTags(): Tag[] {
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[];
}

export function getTagById(id: number): Tag | undefined {
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | undefined;
}

export function getTagByName(name: string): Tag | undefined {
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as Tag | undefined;
}

export function createTag(name: string): Tag {
  const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  return getTagById(result.lastInsertRowid as number)!;
}

export function deleteTag(id: number): boolean {
  db.prepare('DELETE FROM item_tags WHERE tag_id = ?').run(id);
  const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getTagsForItem(itemId: number): Tag[] {
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN item_tags it ON it.tag_id = t.id
    WHERE it.tracked_item_id = ?
    ORDER BY t.name
  `).all(itemId) as Tag[];
}

export function assignTagToItem(itemId: number, tagId: number): boolean {
  try {
    db.prepare('INSERT INTO item_tags (tracked_item_id, tag_id) VALUES (?, ?)').run(itemId, tagId);
    return true;
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return false;
    throw err;
  }
}

export function removeTagFromItem(itemId: number, tagId: number): boolean {
  const result = db.prepare('DELETE FROM item_tags WHERE tracked_item_id = ? AND tag_id = ?').run(itemId, tagId);
  return result.changes > 0;
}

export function getItemsForTag(tagId: number) {
  return db.prepare(`
    SELECT ti.* FROM tracked_items ti
    JOIN item_tags it ON it.tracked_item_id = ti.id
    WHERE it.tag_id = ?
    ORDER BY ti.created_at DESC
  `).all(tagId);
}
