import db from '../db/connection';
import {
  insertGithubWeekly, insertGA4Weekly, insertBingWeekly,
} from '../db/queries/rollup';
import { writeTrackedMetric, refreshUnifiedMetric, calcPerformanceScore } from '../lanes/unify';
import { getWeekStart, getWeekEnd, getPreviousWeekStart } from '../utils/week';
import { getLocalDate } from '../utils/timezone';

export function runWeeklyRollup(weekStartDate?: string): void {
  const periodStart = weekStartDate || getPreviousWeekStart();
  const periodEnd = getWeekEnd(periodStart);

  console.log(`[Rollup] Running weekly rollup for ${periodStart} to ${periodEnd}`);

  const items = db.prepare(`
    SELECT ti.id, ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
    WHERE ti.is_active = 1
  `).all() as Array<{ id: number; platform: string }>;

  let count = 0;

  const WEEKLY_TABLES: Record<string, string> = {
    github: 'github_weekly', ga4: 'ga4_weekly', bing: 'bing_weekly',
  };
  const DAILY_TABLES: Record<string, string> = {
    github: 'github_daily', ga4: 'ga4_daily', bing: 'bing_daily',
  };

  for (const item of items) {
    try {
      switch (item.platform) {
        case 'github':  insertGithubWeekly(item.id, periodStart, periodEnd); break;
        case 'ga4':     insertGA4Weekly(item.id, periodStart, periodEnd); break;
        case 'bing':    insertBingWeekly(item.id, periodStart, periodEnd); break;
      }

      // AVG the daily interest_scores for this period
      const dailyTable = DAILY_TABLES[item.platform];
      const weeklyTable = WEEKLY_TABLES[item.platform];
      if (dailyTable && weeklyTable) {
        const avg = db.prepare(
          `SELECT AVG(interest_score) as avg_score FROM ${dailyTable} WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ?`
        ).get(item.id, periodStart, periodEnd) as { avg_score: number | null } | undefined;
        if (avg?.avg_score != null) {
          db.prepare(
            `UPDATE ${weeklyTable} SET interest_score = ? WHERE tracked_item_id = ? AND period_start = ?`
          ).run(Math.round(avg.avg_score * 100) / 100, item.id, periodStart);
        }
      }

      // Write weekly tracked_metrics from daily sums
      const dailySums = db.prepare(`
        SELECT COALESCE(SUM(reach_value), 0) as reach, COALESCE(SUM(interest_value), 0) as interest, COALESCE(SUM(engagement_value), 0) as engagement
        FROM tracked_metrics WHERE tracked_item_id = ? AND period_type = 'daily' AND period_start BETWEEN ? AND ?
      `).get(item.id, periodStart, periodEnd) as { reach: number; interest: number; engagement: number };
      writeTrackedMetric(item.id, item.platform, 'weekly', periodStart, periodEnd, dailySums);

      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed weekly rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  // Refresh unified_metrics for all platforms
  for (const platform of Object.keys(WEEKLY_TABLES)) {
    refreshUnifiedMetric(platform, 'weekly', periodStart, periodEnd);
  }

  console.log(`[Rollup] Weekly rollup complete — processed ${count} items`);
}

/**
 * Re-rollup all weekly data from dailies using current week boundaries.
 * Called when week_start_day changes — clears all weekly rows and rebuilds.
 */
export function rerollWeeklyData(weekStartDay: number): void {
  console.log(`[Rollup] Re-rolling weekly data for week start day ${weekStartDay}`);

  // Delete all weekly rows from tracked_metrics and unified_metrics
  db.prepare("DELETE FROM tracked_metrics WHERE period_type = 'weekly'").run();
  db.prepare("DELETE FROM unified_metrics WHERE period_type = 'weekly'").run();

  // Delete platform weekly tables
  for (const table of ['github_weekly', 'ga4_weekly', 'bing_weekly']) {
    try { db.prepare(`DELETE FROM ${table}`).run(); } catch { /* table may not exist */ }
  }

  // Find the date range of all daily data
  const range = db.prepare(
    "SELECT MIN(period_start) as min_date, MAX(period_start) as max_date FROM unified_metrics WHERE period_type = 'daily'"
  ).get() as { min_date: string | null; max_date: string | null };

  if (!range?.min_date || !range?.max_date) {
    console.log('[Rollup] No daily data to re-roll');
    return;
  }

  // Walk through each week from min_date to max_date
  let current = getWeekStart(range.min_date, weekStartDay);
  const end = range.max_date;
  const weeks: string[] = [];

  while (current <= end) {
    weeks.push(current);
    const d = new Date(current + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    current = getLocalDate(d);
  }

  // Re-rollup each week
  for (const weekStart of weeks) {
    runWeeklyRollup(weekStart);
  }

  console.log(`[Rollup] Re-rolled ${weeks.length} weeks`);
}
