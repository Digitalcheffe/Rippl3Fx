import db from '../db/connection';
import {
  insertGithubMonthly, insertRedditMonthly, insertGA4Monthly, insertBingMonthly,
} from '../db/queries/rollup';

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Check if tomorrow is a new month (used by scheduler to decide if rollup should run).
 */
export function isTomorrowNewMonth(): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

export function runMonthlyRollup(year?: number, month?: number): void {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? (now.getMonth() + 1); // 1-indexed

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

  for (const item of items) {
    try {
      switch (item.platform) {
        case 'github':  insertGithubMonthly(item.id, periodStart, periodEnd); break;
        case 'reddit':  insertRedditMonthly(item.id, periodStart, periodEnd); break;
        case 'ga4':     insertGA4Monthly(item.id, periodStart, periodEnd); break;
        case 'bing':    insertBingMonthly(item.id, periodStart, periodEnd); break;
      }
      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed monthly rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Monthly rollup complete — processed ${count} items`);
}
