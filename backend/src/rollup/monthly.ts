import db from '../db/connection';
import {
  insertGithubMonthly, insertRedditMonthly, insertGA4Monthly, insertBingMonthly,
} from '../db/queries/rollup';
import { getLocalYearMonth } from '../utils/timezone';

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Runs on the 1st of each month — rolls up the previous month's data.
 */
export function runMonthlyRollup(year?: number, month?: number): void {
  let y: number, m: number;

  if (year != null && month != null) {
    y = year;
    m = month;
  } else {
    // Running on the 1st — roll up previous month
    const now = getLocalYearMonth();
    m = now.month - 1;
    y = now.year;
    if (m < 1) { m = 12; y--; }
  }

  const periodStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = getLastDayOfMonth(y, m);
  const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  console.log(`[Rollup] Running monthly rollup for ${periodStart} to ${periodEnd}`);

  const items = db.prepare(`
    SELECT ti.id, ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
    WHERE ti.is_active = 1
  `).all() as Array<{ id: number; platform: string }>;

  let count = 0;

  const MONTHLY_TABLES: Record<string, string> = {
    github: 'github_monthly', reddit: 'reddit_monthly', ga4: 'ga4_monthly', bing: 'bing_monthly',
  };
  const DAILY_TABLES: Record<string, string> = {
    github: 'github_daily', reddit: 'reddit_daily', ga4: 'ga4_daily', bing: 'bing_daily',
  };

  for (const item of items) {
    try {
      switch (item.platform) {
        case 'github':  insertGithubMonthly(item.id, periodStart, periodEnd); break;
        case 'reddit':  insertRedditMonthly(item.id, periodStart, periodEnd); break;
        case 'ga4':     insertGA4Monthly(item.id, periodStart, periodEnd); break;
        case 'bing':    insertBingMonthly(item.id, periodStart, periodEnd); break;
      }

      // AVG the daily interest_scores for this period
      const dailyTable = DAILY_TABLES[item.platform];
      const monthlyTable = MONTHLY_TABLES[item.platform];
      if (dailyTable && monthlyTable) {
        const avg = db.prepare(
          `SELECT AVG(interest_score) as avg_score FROM ${dailyTable} WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ?`
        ).get(item.id, periodStart, periodEnd) as { avg_score: number | null } | undefined;
        if (avg?.avg_score != null) {
          db.prepare(
            `UPDATE ${monthlyTable} SET interest_score = ? WHERE tracked_item_id = ? AND period_start = ?`
          ).run(Math.round(avg.avg_score * 100) / 100, item.id, periodStart);
        }
      }

      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed monthly rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Monthly rollup complete — processed ${count} items`);
}
