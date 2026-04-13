import db from '../connection';

// GitHub daily rollup — all metrics use MAX (snapshots store cumulative totals from the API)
export function insertGithubDaily(trackedItemId: number, date: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO github_daily
      (tracked_item_id, stars, forks, open_issues, traffic_views, traffic_uniques, clones, clones_uniques, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT
      tracked_item_id,
      MAX(stars),
      MAX(forks),
      MAX(open_issues),
      MAX(traffic_views),
      MAX(traffic_uniques),
      MAX(clones),
      MAX(clones_uniques),
      COALESCE(MAX(traffic_views), 0) + COALESCE(MAX(traffic_uniques), 0),
      0,
      COALESCE(MAX(forks), 0) + COALESCE(MAX(clones), 0) + COALESCE(MAX(clones_uniques), 0),
      ?, ?
    FROM github_snapshots
    WHERE tracked_item_id = ?
      AND DATE(collected_at) = ?
    GROUP BY tracked_item_id
  `).run(date, date, trackedItemId, date);
}

// Reddit daily rollup — upvotes/comment_count/view_count: MAX (cumulative), upvote_ratio: AVG (ratio)
export function insertRedditDaily(trackedItemId: number, date: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO reddit_daily
      (tracked_item_id, upvotes, upvote_ratio, comment_count, view_count, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT
      tracked_item_id,
      MAX(upvotes),
      AVG(upvote_ratio),
      MAX(comment_count),
      MAX(view_count),
      COALESCE(MAX(view_count), 0),
      0,
      COALESCE(MAX(comment_count), 0),
      ?, ?
    FROM reddit_snapshots
    WHERE tracked_item_id = ?
      AND DATE(collected_at) = ?
    GROUP BY tracked_item_id
  `).run(date, date, trackedItemId, date);
}

// GA4 daily rollup — sessions/pageviews/users: SUM (incremental), engagement_rate: AVG (ratio)
export function insertGA4Daily(trackedItemId: number, date: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO ga4_daily
      (tracked_item_id, sessions, pageviews, users, engagement_rate, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT
      tracked_item_id,
      SUM(sessions),
      SUM(pageviews),
      SUM(users),
      AVG(engagement_rate),
      COALESCE(SUM(pageviews), 0),
      0,
      COALESCE(SUM(sessions), 0),
      ?, ?
    FROM ga4_snapshots
    WHERE tracked_item_id = ?
      AND DATE(collected_at) = ?
    GROUP BY tracked_item_id
  `).run(date, date, trackedItemId, date);
}

// Bing daily rollup — impressions/clicks: SUM (incremental), ctr/avg_rank: AVG (ratio)
export function insertBingDaily(trackedItemId: number, date: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO bing_daily
      (tracked_item_id, impressions, clicks, ctr, avg_rank, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT
      tracked_item_id,
      SUM(impressions),
      SUM(clicks),
      AVG(ctr),
      AVG(avg_rank),
      COALESCE(SUM(impressions), 0),
      0,
      COALESCE(SUM(clicks), 0),
      ?, ?
    FROM bing_snapshots
    WHERE tracked_item_id = ?
      AND DATE(collected_at) = ?
    GROUP BY tracked_item_id
  `).run(date, date, trackedItemId, date);
}

// ── Weekly rollup helpers (aggregate from _daily tables) ──

export function insertGithubWeekly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO github_weekly
      (tracked_item_id, stars, forks, open_issues, traffic_views, traffic_uniques, clones, clones_uniques, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, MAX(stars), MAX(forks), MAX(open_issues), MAX(traffic_views), MAX(traffic_uniques), MAX(clones), MAX(clones_uniques),
      COALESCE(MAX(traffic_views), 0) + COALESCE(MAX(traffic_uniques), 0), 0,
      COALESCE(MAX(forks), 0) + COALESCE(MAX(clones), 0) + COALESCE(MAX(clones_uniques), 0),
      ?, ?
    FROM github_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

export function insertRedditWeekly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO reddit_weekly
      (tracked_item_id, upvotes, upvote_ratio, comment_count, view_count, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, MAX(upvotes), AVG(upvote_ratio), MAX(comment_count), MAX(view_count),
      COALESCE(MAX(view_count), 0), 0, COALESCE(MAX(comment_count), 0),
      ?, ?
    FROM reddit_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

export function insertGA4Weekly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO ga4_weekly
      (tracked_item_id, sessions, pageviews, users, engagement_rate, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, SUM(sessions), SUM(pageviews), SUM(users), AVG(engagement_rate),
      COALESCE(SUM(pageviews), 0), 0, COALESCE(SUM(sessions), 0),
      ?, ?
    FROM ga4_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

export function insertBingWeekly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO bing_weekly
      (tracked_item_id, impressions, clicks, ctr, avg_rank, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, SUM(impressions), SUM(clicks), AVG(ctr), AVG(avg_rank),
      COALESCE(SUM(impressions), 0), 0, COALESCE(SUM(clicks), 0),
      ?, ?
    FROM bing_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

// ── Monthly rollup helpers (aggregate from _daily tables) ──

export function insertGithubMonthly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO github_monthly
      (tracked_item_id, stars, forks, open_issues, traffic_views, traffic_uniques, clones, clones_uniques, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, MAX(stars), MAX(forks), MAX(open_issues), MAX(traffic_views), MAX(traffic_uniques), MAX(clones), MAX(clones_uniques),
      COALESCE(MAX(traffic_views), 0) + COALESCE(MAX(traffic_uniques), 0), 0,
      COALESCE(MAX(forks), 0) + COALESCE(MAX(clones), 0) + COALESCE(MAX(clones_uniques), 0),
      ?, ?
    FROM github_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

export function insertRedditMonthly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO reddit_monthly
      (tracked_item_id, upvotes, upvote_ratio, comment_count, view_count, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, MAX(upvotes), AVG(upvote_ratio), MAX(comment_count), MAX(view_count),
      COALESCE(MAX(view_count), 0), 0, COALESCE(MAX(comment_count), 0),
      ?, ?
    FROM reddit_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

export function insertGA4Monthly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO ga4_monthly
      (tracked_item_id, sessions, pageviews, users, engagement_rate, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, SUM(sessions), SUM(pageviews), SUM(users), AVG(engagement_rate),
      COALESCE(SUM(pageviews), 0), 0, COALESCE(SUM(sessions), 0),
      ?, ?
    FROM ga4_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}

export function insertBingMonthly(trackedItemId: number, periodStart: string, periodEnd: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO bing_monthly
      (tracked_item_id, impressions, clicks, ctr, avg_rank, reach_score, interest_score, engagement_score, period_start, period_end)
    SELECT tracked_item_id, SUM(impressions), SUM(clicks), AVG(ctr), AVG(avg_rank),
      COALESCE(SUM(impressions), 0), 0, COALESCE(SUM(clicks), 0),
      ?, ?
    FROM bing_daily WHERE tracked_item_id = ? AND period_start BETWEEN ? AND ? GROUP BY tracked_item_id
  `).run(periodStart, periodEnd, trackedItemId, periodStart, periodEnd);
}
