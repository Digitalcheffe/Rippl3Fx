import db from '../db/connection';
import { getPerformanceWeights } from '../routes/performance';

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
        reach: (row.traffic_views ?? 0) + (row.traffic_uniques ?? 0),
        interest: (row.stars ?? 0) + (row.forks ?? 0),
        engagement: (row.clones ?? 0) + (row.clones_uniques ?? 0),
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
}

/**
 * Full write: map raw platform data → write tracked_metrics → refresh unified_metrics.
 * Call this after any snapshot or rollup insert.
 */
export function writeMetrics(
  trackedItemId: number,
  platform: string,
  periodType: string,
  periodStart: string,
  periodEnd: string,
  rawRow: Record<string, any>,
): void {
  const lanes = mapToLanes(platform, rawRow);
  writeTrackedMetric(trackedItemId, platform, periodType, periodStart, periodEnd, lanes);
  refreshUnifiedMetric(platform, periodType, periodStart, periodEnd);
}
