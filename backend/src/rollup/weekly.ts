import db from '../db/connection';
import {
  insertGithubWeekly, insertRedditWeekly, insertGA4Weekly, insertBingWeekly,
} from '../db/queries/rollup';

/**
 * Get Monday of the week containing the given date.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → previous Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function runWeeklyRollup(weekStartDate?: string): void {
  let monday: Date;
  if (weekStartDate) {
    monday = new Date(weekStartDate);
  } else {
    monday = getMonday(new Date());
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const periodStart = fmt(monday);
  const periodEnd = fmt(sunday);

  console.log(`[Rollup] Running weekly rollup for ${periodStart} to ${periodEnd}`);

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
        case 'github':  insertGithubWeekly(item.id, periodStart, periodEnd); break;
        case 'reddit':  insertRedditWeekly(item.id, periodStart, periodEnd); break;
        case 'ga4':     insertGA4Weekly(item.id, periodStart, periodEnd); break;
        case 'bing':    insertBingWeekly(item.id, periodStart, periodEnd); break;
      }
      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed weekly rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Weekly rollup complete — processed ${count} items`);
}
