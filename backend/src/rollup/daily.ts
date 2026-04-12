import db from '../db/connection';
import { insertGithubDaily, insertRedditDaily, insertGA4Daily, insertBingDaily } from '../db/queries/rollup';
import { computeInterestScore } from '../lanes/score';

const DAILY_TABLES: Record<string, string> = {
  github: 'github_daily',
  reddit: 'reddit_daily',
  ga4:    'ga4_daily',
  bing:   'bing_daily',
};

const METRIC_COLUMNS: Record<string, string[]> = {
  github: ['stars', 'forks', 'open_issues', 'traffic_views', 'traffic_uniques', 'clones', 'clones_uniques'],
  reddit: ['upvotes', 'upvote_ratio', 'comment_count', 'view_count'],
  ga4:    ['sessions', 'pageviews', 'users', 'engagement_rate'],
  bing:   ['impressions', 'clicks', 'ctr', 'avg_rank'],
};

function updateDailyInterestScore(trackedItemId: number, platform: string, date: string): void {
  const table = DAILY_TABLES[platform];
  const columns = METRIC_COLUMNS[platform];
  if (!table || !columns) return;

  const row = db.prepare(
    `SELECT ${columns.join(', ')} FROM ${table} WHERE tracked_item_id = ? AND period_start = ?`
  ).get(trackedItemId, date) as Record<string, number> | undefined;

  if (!row) return;

  const metrics: Record<string, number> = {};
  for (const col of columns) {
    metrics[col] = row[col] ?? 0;
  }

  const score = computeInterestScore(trackedItemId, platform, metrics);

  db.prepare(
    `UPDATE ${table} SET interest_score = ? WHERE tracked_item_id = ? AND period_start = ?`
  ).run(score, trackedItemId, date);
}

export function runDailyRollup(date?: string): void {
  const rollupDate = date || new Date().toISOString().split('T')[0];
  console.log(`[Rollup] Running daily rollup for ${rollupDate}`);

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
        case 'github':  insertGithubDaily(item.id, rollupDate); break;
        case 'reddit':  insertRedditDaily(item.id, rollupDate); break;
        case 'ga4':     insertGA4Daily(item.id, rollupDate); break;
        case 'bing':    insertBingDaily(item.id, rollupDate); break;
      }
      // Compute and store interest score for the daily row
      updateDailyInterestScore(item.id, item.platform, rollupDate);
      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed daily rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Daily rollup complete — processed ${count} items`);
}
