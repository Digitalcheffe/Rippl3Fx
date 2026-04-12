import db from '../db/connection';
import { insertGithubDaily, insertRedditDaily, insertGA4Daily, insertBingDaily } from '../db/queries/rollup';

export function runDailyRollup(date?: string): void {
  const rollupDate = date || new Date().toISOString().split('T')[0];
  console.log(`[Rollup] Running daily rollup for ${rollupDate}`);

  // Get all active tracked items grouped by platform
  const items = db.prepare(`
    SELECT ti.id, ti.metric_account_id, ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
    WHERE ti.is_active = 1
  `).all() as Array<{ id: number; metric_account_id: number; platform: string }>;

  let count = 0;

  for (const item of items) {
    try {
      switch (item.platform) {
        case 'github':
          insertGithubDaily(item.id, rollupDate);
          break;
        case 'reddit':
          insertRedditDaily(item.id, rollupDate);
          break;
        case 'ga4':
          insertGA4Daily(item.id, rollupDate);
          break;
        case 'bing':
          insertBingDaily(item.id, rollupDate);
          break;
      }
      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed daily rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Daily rollup complete — processed ${count} items`);
}
