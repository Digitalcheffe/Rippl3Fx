import db from '../db/connection';
import { getPerformanceWeights } from '../routes/performance';
import { calcLanesFromRaw } from './calc';

/**
 * Lane mapping: platform-specific raw metrics → Reach / Interest / Engagement
 * These produce the SAME values shown in the UI cards — no hidden normalization.
 */

interface LaneValues {
  reach: number;
  interest: number;
  engagement: number;
}

/** Map a platform snapshot or daily row to lane values. */
export function mapToLanes(platform: string, row: Record<string, any>): LaneValues {
  switch (platform) {
    case 'github':
      return {
        reach: row.traffic_views ?? 0,
        interest: (row.stars ?? 0) + (row.watchers ?? 0),
        engagement: (row.forks ?? 0) + (row.clones ?? 0) + (row.release_downloads ?? 0),
      };
    case 'ga4':
      return {
        reach: row.pageviews ?? 0,
        interest: row.users ?? 0,
        engagement: row.sessions ?? 0,
      };
    case 'bing':
      return {
        reach: row.impressions ?? 0,
        interest: row.clicks ?? 0,
        engagement: row.ctr != null ? Math.round(row.ctr * 10000) / 100 : 0, // ctr × 100
      };
    default:
      return { reach: 0, interest: 0, engagement: 0 };
  }
}

/** Calculate performance score from lane values using stored weights. */
export function calcPerformanceScore(lanes: LaneValues): number {
  const w = getPerformanceWeights();
  const score = (lanes.reach * w.reach) + (lanes.interest * w.interest) + (lanes.engagement * w.engagement);
  return Math.round(score * 100) / 100;
}

/** Write a row to tracked_metrics (per-item). Uses INSERT OR REPLACE to upsert. */
export function writeTrackedMetric(
  trackedItemId: number,
  platform: string,
  periodType: string,
  periodStart: string,
  periodEnd: string,
  lanes: LaneValues,
): void {
  const perf = calcPerformanceScore(lanes);
  db.prepare(`
    INSERT INTO tracked_metrics (tracked_item_id, platform, period_type, period_start, period_end, reach_value, interest_value, engagement_value, performance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tracked_item_id, period_type, period_start) DO UPDATE SET
      reach_value = excluded.reach_value,
      interest_value = excluded.interest_value,
      engagement_value = excluded.engagement_value,
      performance_score = excluded.performance_score
  `).run(trackedItemId, platform, periodType, periodStart, periodEnd, lanes.reach, lanes.interest, lanes.engagement, perf);

  // Update item-level peaks
  updatePeaks(trackedItemId, platform, periodType, periodStart, lanes);
}

/** Recalculate and write unified_metrics (platform-level) by summing all tracked_metrics for that platform + period. */
export function refreshUnifiedMetric(platform: string, periodType: string, periodStart: string, periodEnd: string): void {
  // Sum all tracked items for this platform + period
  const row = db.prepare(`
    SELECT COALESCE(SUM(reach_value), 0) as reach,
           COALESCE(SUM(interest_value), 0) as interest,
           COALESCE(SUM(engagement_value), 0) as engagement
    FROM tracked_metrics
    WHERE platform = ? AND period_type = ? AND period_start = ?
  `).get(platform, periodType, periodStart) as { reach: number; interest: number; engagement: number };

  const lanes: LaneValues = { reach: row.reach, interest: row.interest, engagement: row.engagement };
  const perf = calcPerformanceScore(lanes);

  db.prepare(`
    INSERT INTO unified_metrics (platform, period_type, period_start, period_end, reach_value, interest_value, engagement_value, performance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, period_type, period_start) DO UPDATE SET
      reach_value = excluded.reach_value,
      interest_value = excluded.interest_value,
      engagement_value = excluded.engagement_value,
      performance_score = excluded.performance_score
  `).run(platform, periodType, periodStart, periodEnd, lanes.reach, lanes.interest, lanes.engagement, perf);

  // Update platform-level peaks (tracked_item_id = null)
  updatePeaks(null, platform, periodType, periodStart, lanes);
}

/** Update peak_metrics if any lane value exceeds the stored peak. */
export function updatePeaks(trackedItemId: number | null, platform: string, periodType: string, periodStart: string, lanes: LaneValues): void {
  // Skip hourly — peaks only tracked for daily/weekly/monthly
  if (periodType === 'hourly') return;

  const existing = db.prepare(
    'SELECT * FROM peak_metrics WHERE tracked_item_id IS ? AND platform = ? AND period_type = ?'
  ).get(trackedItemId, platform, periodType) as Record<string, any> | undefined;

  if (!existing) {
    // First entry — insert
    db.prepare(`
      INSERT INTO peak_metrics (tracked_item_id, platform, period_type, reach_peak, interest_peak, engagement_peak, reach_peak_date, interest_peak_date, engagement_peak_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(trackedItemId, platform, periodType, lanes.reach, lanes.interest, lanes.engagement, periodStart, periodStart, periodStart);
    return;
  }

  // Update only if new value exceeds stored peak
  const updates: string[] = [];
  const params: any[] = [];

  if (lanes.reach > (existing.reach_peak ?? 0)) {
    updates.push('reach_peak = ?, reach_peak_date = ?');
    params.push(lanes.reach, periodStart);
  }
  if (lanes.interest > (existing.interest_peak ?? 0)) {
    updates.push('interest_peak = ?, interest_peak_date = ?');
    params.push(lanes.interest, periodStart);
  }
  if (lanes.engagement > (existing.engagement_peak ?? 0)) {
    updates.push('engagement_peak = ?, engagement_peak_date = ?');
    params.push(lanes.engagement, periodStart);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    db.prepare(
      `UPDATE peak_metrics SET ${updates.join(', ')} WHERE tracked_item_id IS ? AND platform = ? AND period_type = ?`
    ).run(...params, trackedItemId, platform, periodType);
  }
}

/** Get peak values for an item or platform. */
export function getPeaks(trackedItemId: number | null, platform: string, periodType: string): { reach_peak: number; interest_peak: number; engagement_peak: number; reach_peak_date: string | null; interest_peak_date: string | null; engagement_peak_date: string | null } | null {
  const row = db.prepare(
    'SELECT reach_peak, interest_peak, engagement_peak, reach_peak_date, interest_peak_date, engagement_peak_date FROM peak_metrics WHERE tracked_item_id IS ? AND platform = ? AND period_type = ?'
  ).get(trackedItemId, platform, periodType) as any;
  return row ?? null;
}

/** Write a row to tracked_hourly_metrics (separate throwaway table, purged after 48hrs). */
export function writeHourlyMetric(
  trackedItemId: number,
  platform: string,
  periodStart: string,
  lanes: LaneValues,
): void {
  const perf = calcPerformanceScore(lanes);
  db.prepare(`
    INSERT INTO tracked_hourly_metrics (tracked_item_id, platform, period_start, reach_value, interest_value, engagement_value, performance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tracked_item_id, period_start) DO UPDATE SET
      reach_value = excluded.reach_value,
      interest_value = excluded.interest_value,
      engagement_value = excluded.engagement_value,
      performance_score = excluded.performance_score
  `).run(trackedItemId, platform, periodStart, lanes.reach, lanes.interest, lanes.engagement, perf);
}

/**
 * Full write: raw platform data → write metrics → refresh unified → update peaks.
 * Hourly: raw values mapped to lanes via mapToLanes (no delta tracking).
 * Daily/weekly/monthly: config-driven lane calc via calcLanesFromRaw (delta tracking).
 */
export function writeMetrics(
  trackedItemId: number,
  platform: string,
  periodType: string,
  periodStart: string,
  periodEnd: string,
  rawRow: Record<string, any>,
  accountId?: number,
): void {
  if (periodType === 'hourly') {
    // Hourly = raw snapshot, no delta tracking
    const lanes = mapToLanes(platform, rawRow);
    writeHourlyMetric(trackedItemId, platform, periodStart, lanes);
  } else {
    // Daily/weekly/monthly = config-driven lane calc with delta tracking
    const lanes = accountId
      ? calcLanesFromRaw(accountId, platform, rawRow, true, trackedItemId)
      : mapToLanes(platform, rawRow);
    writeTrackedMetric(trackedItemId, platform, periodType, periodStart, periodEnd, lanes);
    refreshUnifiedMetric(platform, periodType, periodStart, periodEnd);
  }
}
