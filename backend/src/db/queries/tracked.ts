import db from '../connection';

/** Get the latest tracked_metrics row for an item + period type. */
export function getLatestTracked(trackedItemId: number, periodType: string): Record<string, any> | null {
  return db.prepare(
    'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT 1'
  ).get(trackedItemId, periodType) as Record<string, any> | undefined ?? null;
}

/** Get the two most recent tracked_metrics rows for velocity. */
export function getTrackedPair(trackedItemId: number, periodType: string): { current: Record<string, any> | null; previous: Record<string, any> | null } {
  const rows = db.prepare(
    'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT 2'
  ).all(trackedItemId, periodType) as Record<string, any>[];
  return { current: rows[0] ?? null, previous: rows[1] ?? null };
}

/** Get N most recent tracked_metrics rows for an item's trend chart. */
export function getTrackedHistory(trackedItemId: number, periodType: string, limit: number = 7): Record<string, any>[] {
  return db.prepare(
    'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT ?'
  ).all(trackedItemId, periodType, limit) as Record<string, any>[];
}

/** Get all tracked_metrics for a platform + period (for platform page item breakdown). */
export function getTrackedByPlatform(platform: string, periodType: string, periodStart: string): Record<string, any>[] {
  return db.prepare(
    'SELECT * FROM tracked_metrics WHERE platform = ? AND period_type = ? AND period_start = ?'
  ).all(platform, periodType, periodStart) as Record<string, any>[];
}

/** Get tracked_metrics for specific tagged items (for tag filter). */
export function getTrackedByTag(tagName: string, periodType: string, limit: number = 7): Record<string, any>[] {
  return db.prepare(`
    SELECT tm.* FROM tracked_metrics tm
    JOIN item_tags it ON tm.tracked_item_id = it.tracked_item_id
    JOIN tags t ON t.id = it.tag_id
    WHERE t.name = ? AND tm.period_type = ?
    ORDER BY tm.period_start DESC
    LIMIT ?
  `).all(tagName, periodType, limit) as Record<string, any>[];
}

/** Purge all tracked_metrics for an item (permanent delete). */
export function purgeTrackedMetrics(trackedItemId: number): number {
  const result = db.prepare('DELETE FROM tracked_metrics WHERE tracked_item_id = ?').run(trackedItemId);
  return result.changes;
}

/** Purge all tracked_metrics for all items under an account (permanent account delete). */
export function purgeTrackedMetricsByAccount(accountId: number): number {
  const result = db.prepare(`
    DELETE FROM tracked_metrics WHERE tracked_item_id IN (
      SELECT id FROM tracked_items WHERE metric_account_id = ?
    )
  `).run(accountId);
  return result.changes;
}
