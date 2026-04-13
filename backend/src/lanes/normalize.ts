import db from '../db/connection';

/**
 * Normalize a value to 0–100 based on historical peak.
 * If peak is 0, returns 0.
 */
export function normalizeValue(value: number, historicalPeak: number): number {
  if (historicalPeak <= 0) return 0;
  const normalized = (value / historicalPeak) * 100;
  return Math.max(0, Math.min(100, normalized));
}

const SNAPSHOT_TABLES: Record<string, string> = {
  github: 'github_snapshots',
  ga4:    'ga4_snapshots',
  bing:   'bing_snapshots',
};

/**
 * Get the historical peak (MAX) value for a specific metric on a tracked item.
 * Queries the snapshot table for that platform.
 */
export function getHistoricalPeak(trackedItemId: number, platform: string, metric: string): number {
  const table = SNAPSHOT_TABLES[platform];
  if (!table) return 0;

  // Validate metric name to prevent SQL injection (only allow alphanumeric + underscore)
  if (!/^[a-z_]+$/.test(metric)) return 0;

  const row = db.prepare(
    `SELECT MAX(${metric}) as peak FROM ${table} WHERE tracked_item_id = ?`
  ).get(trackedItemId) as { peak: number | null } | undefined;

  return row?.peak ?? 0;
}
