import db from '../connection';
import { getLocalDate } from '../../utils/timezone';

/** Get Monday of the week containing a date. */
function getMonday(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/** Get first day of the month containing a date. */
function getMonthStart(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Compute current week/month for an item by summing dailies. */
function computeCurrentPeriod(trackedItemId: number, periodType: 'weekly' | 'monthly'): Record<string, any> | null {
  const today = getLocalDate();
  let periodStart: string, periodEnd: string;

  if (periodType === 'weekly') {
    periodStart = getMonday(today);
    const sun = new Date(new Date(periodStart + 'T12:00:00').getTime() + 6 * 86_400_000);
    periodEnd = sun.toISOString().split('T')[0];
  } else {
    periodStart = getMonthStart(today);
    const [y, m] = periodStart.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  const row = db.prepare(`
    SELECT ? as tracked_item_id, ? as period_type, ? as period_start, ? as period_end,
           COALESCE(SUM(reach_value), 0) as reach_value,
           COALESCE(SUM(interest_value), 0) as interest_value,
           COALESCE(SUM(engagement_value), 0) as engagement_value,
           COALESCE(SUM(performance_score), 0) as performance_score,
           platform
    FROM tracked_metrics
    WHERE tracked_item_id = ? AND period_type = 'daily'
      AND period_start >= ? AND period_start <= ?
  `).get(trackedItemId, periodType, periodStart, periodEnd, trackedItemId, periodStart, periodEnd) as Record<string, any> | undefined;

  if (!row || (row.reach_value === 0 && row.interest_value === 0 && row.engagement_value === 0)) return null;
  return row;
}

/** Get the latest tracked_metrics row for an item + period type. */
export function getLatestTracked(trackedItemId: number, periodType: string): Record<string, any> | null {
  return db.prepare(
    'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT 1'
  ).get(trackedItemId, periodType) as Record<string, any> | undefined ?? null;
}

/** Get the two most recent tracked_metrics rows for velocity. For weekly/monthly, includes live current period. */
export function getTrackedPair(trackedItemId: number, periodType: string): { current: Record<string, any> | null; previous: Record<string, any> | null } {
  if (periodType === 'weekly' || periodType === 'monthly') {
    // Try live current period first
    const live = computeCurrentPeriod(trackedItemId, periodType);
    // Get stored historical rows
    const stored = db.prepare(
      'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT 2'
    ).all(trackedItemId, periodType) as Record<string, any>[];

    if (live) {
      // Current = live, previous = most recent stored (or second stored if first overlaps)
      const prev = stored.length > 0 && stored[0].period_start === live.period_start
        ? stored[1] ?? null
        : stored[0] ?? null;
      return { current: live, previous: prev };
    }
    return { current: stored[0] ?? null, previous: stored[1] ?? null };
  }

  const rows = db.prepare(
    'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT 2'
  ).all(trackedItemId, periodType) as Record<string, any>[];
  return { current: rows[0] ?? null, previous: rows[1] ?? null };
}

/** Get N most recent tracked_metrics rows for an item's trend chart. For weekly/monthly, includes live current period. */
export function getTrackedHistory(trackedItemId: number, periodType: string, limit: number = 7): Record<string, any>[] {
  if (periodType === 'weekly' || periodType === 'monthly') {
    const live = computeCurrentPeriod(trackedItemId, periodType);
    const stored = db.prepare(
      'SELECT * FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = ? ORDER BY period_start DESC LIMIT ?'
    ).all(trackedItemId, periodType, limit) as Record<string, any>[];

    if (live) {
      // Prepend live if it doesn't overlap with the first stored row
      if (stored.length === 0 || stored[0].period_start !== live.period_start) {
        return [live, ...stored].slice(0, limit);
      }
      // Replace first stored with live (fresher)
      return [live, ...stored.slice(1)].slice(0, limit);
    }
    return stored;
  }

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
