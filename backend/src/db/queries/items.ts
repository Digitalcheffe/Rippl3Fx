import db from '../connection';
import type { TrackedItem } from '../../types';

export function getItemsByAccount(accountId: number): TrackedItem[] {
  return db.prepare(
    'SELECT * FROM tracked_items WHERE metric_account_id = ? ORDER BY created_at DESC'
  ).all(accountId) as TrackedItem[];
}

export function getItemById(id: number): TrackedItem | undefined {
  return db.prepare('SELECT * FROM tracked_items WHERE id = ?').get(id) as TrackedItem | undefined;
}

export function getAllItems(): TrackedItem[] {
  return db.prepare('SELECT * FROM tracked_items ORDER BY created_at DESC').all() as TrackedItem[];
}

export function createItem(accountId: number, platformIdentifier: string, displayName: string): TrackedItem {
  const result = db.prepare(
    'INSERT INTO tracked_items (metric_account_id, platform_identifier, display_name) VALUES (?, ?, ?)'
  ).run(accountId, platformIdentifier, displayName);
  return getItemById(result.lastInsertRowid as number)!;
}

export function updateItem(id: number, updates: { display_name?: string; platform_identifier?: string; is_active?: number }): TrackedItem | undefined {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.display_name !== undefined) { fields.push('display_name = ?'); values.push(updates.display_name); }
  if (updates.platform_identifier !== undefined) { fields.push('platform_identifier = ?'); values.push(updates.platform_identifier); }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }

  if (fields.length === 0) return getItemById(id);

  values.push(id);
  db.prepare(`UPDATE tracked_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getItemById(id);
}

export function deleteItem(id: number): boolean {
  // Remove all related data first
  db.prepare('DELETE FROM item_tags WHERE tracked_item_id = ?').run(id);
  db.prepare('DELETE FROM poll_logs WHERE tracked_item_id = ?').run(id);
  // Snapshots
  for (const table of ['github_snapshots', 'reddit_snapshots', 'ga4_snapshots', 'bing_snapshots']) {
    db.prepare(`DELETE FROM ${table} WHERE tracked_item_id = ?`).run(id);
  }
  // Rollups
  for (const table of ['github_daily', 'github_weekly', 'github_monthly', 'reddit_daily', 'reddit_weekly', 'reddit_monthly', 'ga4_daily', 'ga4_weekly', 'ga4_monthly', 'bing_daily', 'bing_weekly', 'bing_monthly']) {
    db.prepare(`DELETE FROM ${table} WHERE tracked_item_id = ?`).run(id);
  }
  const result = db.prepare('DELETE FROM tracked_items WHERE id = ?').run(id);
  return result.changes > 0;
}
