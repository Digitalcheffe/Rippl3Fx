import db from '../db/connection';
import { computeInterestScore } from './score';

const DAILY_TABLES: Record<string, string> = {
  github: 'github_daily',
  ga4:    'ga4_daily',
  bing:   'bing_daily',
};

const METRIC_COLUMNS: Record<string, string[]> = {
  github: ['stars', 'forks', 'open_issues', 'traffic_views', 'traffic_uniques', 'clones', 'clones_uniques'],
  ga4:    ['sessions', 'pageviews', 'users', 'engagement_rate'],
  bing:   ['impressions', 'clicks', 'ctr', 'avg_rank'],
};

/**
 * Recompute interest_score for all existing daily rollup rows.
 * Useful after weight changes.
 */
export function backfillInterestScores(): void {
  console.log('[Backfill] Recomputing all daily interest scores');

  let total = 0;

  for (const [platform, table] of Object.entries(DAILY_TABLES)) {
    const columns = METRIC_COLUMNS[platform];
    if (!columns) continue;

    const rows = db.prepare(
      `SELECT id, tracked_item_id, ${columns.join(', ')} FROM ${table}`
    ).all() as Array<Record<string, number>>;

    for (const row of rows) {
      const metrics: Record<string, number> = {};
      for (const col of columns) {
        metrics[col] = row[col] ?? 0;
      }

      const score = computeInterestScore(row.tracked_item_id, platform, metrics);
      db.prepare(`UPDATE ${table} SET interest_score = ? WHERE id = ?`).run(score, row.id);
      total++;
    }
  }

  console.log(`[Backfill] Updated ${total} daily rows`);
}
