import db from '../db/connection';
import {
  insertGithubWeekly, insertRedditWeekly, insertGA4Weekly, insertBingWeekly,
} from '../db/queries/rollup';
import { getLocalDate } from '../utils/timezone';

/**
 * Get Monday of the week containing the given date (timezone-aware).
 */
function getMonday(date: Date): string {
  // Get the local date string, then work with that
  const localStr = getLocalDate(date);
  const d = new Date(localStr + 'T12:00:00'); // noon to avoid DST edge cases
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → previous Monday
  d.setDate(d.getDate() + diff);
  return getLocalDate(d);
}

function getPreviousMonday(): string {
  const now = new Date();
  // Go back 7 days to get into last week, then find that Monday
  const lastWeek = new Date(now.getTime() - 7 * 86_400_000);
  return getMonday(lastWeek);
}

export function runWeeklyRollup(weekStartDate?: string): void {
  const periodStart = weekStartDate || getPreviousMonday();
  // Sunday = Monday + 6 days
  const mondayDate = new Date(periodStart + 'T12:00:00');
  const sundayDate = new Date(mondayDate.getTime() + 6 * 86_400_000);
  const periodEnd = getLocalDate(sundayDate);

  console.log(`[Rollup] Running weekly rollup for ${periodStart} to ${periodEnd}`);

  const items = db.prepare(`
    SELECT ti.id, ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
    WHERE ti.is_active = 1
  `).all() as Array<{ id: number; platform: string }>;

  let count = 0;

  const WEEKLY_TABLES: Record<string, string> = {
    github: 'github_weekly', reddit: 'reddit_weekly', ga4: 'ga4_weekly', bing: 'bing_weekly',
  };
  const DAILY_TABLES: Record<string, string> = {
    github: 'github_daily', reddit: 'reddit_daily', ga4: 'ga4_daily', bing: 'bing_daily',
  };

  for (const item of items) {
    try {
      switch (item.platform) {
        case 'github':  insertGithubWeekly(item.id, periodStart, periodEnd); break;
        case 'reddit':  insertRedditWeekly(item.id, periodStart, periodEnd); break;
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

      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed weekly rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Weekly rollup complete — processed ${count} items`);
}
