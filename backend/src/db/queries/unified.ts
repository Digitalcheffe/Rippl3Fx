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

/** Compute current week/month for a platform by summing dailies from unified_metrics. */
function computeCurrentUnified(platform: string, periodType: 'weekly' | 'monthly'): Record<string, any> | null {
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
    SELECT ? as platform, ? as period_type, ? as period_start, ? as period_end,
           COALESCE(SUM(reach_value), 0) as reach_value,
           COALESCE(SUM(interest_value), 0) as interest_value,
           COALESCE(SUM(engagement_value), 0) as engagement_value,
           COALESCE(SUM(performance_score), 0) as performance_score
    FROM unified_metrics
    WHERE platform = ? AND period_type = 'daily'
      AND period_start >= ? AND period_start <= ?
  `).get(platform, periodType, periodStart, periodEnd, platform, periodStart, periodEnd) as Record<string, any> | undefined;

  if (!row || (row.reach_value === 0 && row.interest_value === 0 && row.engagement_value === 0)) return null;
  return row;
}

/** Get the latest unified_metrics row for a platform + period type. */
export function getLatestUnified(platform: string, periodType: string): Record<string, any> | null {
  return db.prepare(
    'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT 1'
  ).get(platform, periodType) as Record<string, any> | undefined ?? null;
}

/** Get the two most recent unified_metrics rows for velocity. For weekly/monthly, includes live current period. */
export function getUnifiedPair(platform: string, periodType: string): { current: Record<string, any> | null; previous: Record<string, any> | null } {
  if (periodType === 'weekly' || periodType === 'monthly') {
    const live = computeCurrentUnified(platform, periodType);
    const stored = db.prepare(
      'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT 2'
    ).all(platform, periodType) as Record<string, any>[];

    if (live) {
      const prev = stored.length > 0 && stored[0].period_start === live.period_start
        ? stored[1] ?? null
        : stored[0] ?? null;
      return { current: live, previous: prev };
    }
    return { current: stored[0] ?? null, previous: stored[1] ?? null };
  }

  const rows = db.prepare(
    'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT 2'
  ).all(platform, periodType) as Record<string, any>[];
  return { current: rows[0] ?? null, previous: rows[1] ?? null };
}

/** Get N most recent unified_metrics rows for history charts. For weekly/monthly, includes live current period. */
export function getUnifiedHistory(platform: string, periodType: string, limit: number = 7): Record<string, any>[] {
  if (periodType === 'weekly' || periodType === 'monthly') {
    const live = computeCurrentUnified(platform, periodType);
    const stored = db.prepare(
      'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT ?'
    ).all(platform, periodType, limit) as Record<string, any>[];

    if (live) {
      if (stored.length === 0 || stored[0].period_start !== live.period_start) {
        return [live, ...stored].slice(0, limit);
      }
      return [live, ...stored.slice(1)].slice(0, limit);
    }
    return stored;
  }

  return db.prepare(
    'SELECT * FROM unified_metrics WHERE platform = ? AND period_type = ? ORDER BY period_start DESC LIMIT ?'
  ).all(platform, periodType, limit) as Record<string, any>[];
}

/** Get all platforms' two most recent rows for velocity (for Dashboard). */
export function getAllPlatformPairs(periodType: string): Record<string, { current: Record<string, any> | null; previous: Record<string, any> | null }> {
  const platforms = ['github', 'ga4', 'bing'];
  const result: Record<string, { current: Record<string, any> | null; previous: Record<string, any> | null }> = {};
  for (const p of platforms) {
    result[p] = getUnifiedPair(p, periodType);
  }
  return result;
}

/** Get unified history for all platforms (for combined chart). */
export function getAllPlatformHistory(periodType: string, limit: number = 7): Record<string, Record<string, any>[]> {
  const platforms = ['github', 'ga4', 'bing'];
  const result: Record<string, Record<string, any>[]> = {};
  for (const p of platforms) {
    result[p] = getUnifiedHistory(p, periodType, limit);
  }
  return result;
}
