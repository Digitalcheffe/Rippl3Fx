import db from '../connection';

/** Get the latest unified_metrics row for a platform + period type. */
export function getLatestUnified(platform: string, periodType: string): Record<string, any> | null {
  return db.prepare(
    'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT 1'
  ).get(platform, periodType) as Record<string, any> | undefined ?? null;
}

/** Get the two most recent unified_metrics rows for velocity calculation. */
export function getUnifiedPair(platform: string, periodType: string): { current: Record<string, any> | null; previous: Record<string, any> | null } {
  const rows = db.prepare(
    'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT 2'
  ).all(platform, periodType) as Record<string, any>[];
  return { current: rows[0] ?? null, previous: rows[1] ?? null };
}

/** Get N most recent unified_metrics rows for history charts. */
export function getUnifiedHistory(platform: string, periodType: string, limit: number = 7): Record<string, any>[] {
  return db.prepare(
    'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT ?'
  ).all(platform, periodType, limit) as Record<string, any>[];
}

/** Get all platforms' latest unified_metrics for a period type (for Dashboard). */
export function getAllPlatformLatest(periodType: string): Record<string, any>[] {
  return db.prepare(`
    SELECT u.* FROM unified_metrics u
    INNER JOIN (
      SELECT platform, MAX(period_start) as max_start
      FROM unified_metrics WHERE period_type = ?
      GROUP BY platform
    ) latest ON u.platform = latest.platform AND u.period_start = latest.max_start AND u.period_type = ?
  `).all(periodType, periodType) as Record<string, any>[];
}

/** Get all platforms' two most recent rows for velocity (for Dashboard). */
export function getAllPlatformPairs(periodType: string): Record<string, { current: Record<string, any> | null; previous: Record<string, any> | null }> {
  const platforms = ['reddit', 'github', 'ga4', 'bing'];
  const result: Record<string, { current: Record<string, any> | null; previous: Record<string, any> | null }> = {};
  for (const p of platforms) {
    result[p] = getUnifiedPair(p, periodType);
  }
  return result;
}

/** Get unified history for all platforms (for combined chart). */
export function getAllPlatformHistory(periodType: string, limit: number = 7): Record<string, Record<string, any>[]> {
  const platforms = ['reddit', 'github', 'ga4', 'bing'];
  const result: Record<string, Record<string, any>[]> = {};
  for (const p of platforms) {
    result[p] = getUnifiedHistory(p, periodType, limit);
  }
  return result;
}
