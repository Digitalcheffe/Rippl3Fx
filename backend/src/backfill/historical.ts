import db from '../db/connection';
import { decryptCredentials } from '../crypto/credentials';
import { getLocalDate } from '../utils/timezone';
import { computeInterestScore } from '../lanes/score';
import { writeMetrics } from '../lanes/unify';
import { insertPollLog } from '../db/queries/logs';
import type { GithubCredentials, GA4Credentials, BingCredentials } from '../types';

const LOOKBACK_DAYS = 14;

function getDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    dates.push(getLocalDate(d));
  }
  return dates;
}

function getAccountCredentials(accountId: number): { credentials: any; platform: string } | null {
  const row = db.prepare('SELECT credentials, platform FROM metric_accounts WHERE id = ?').get(accountId) as any;
  if (!row) return null;
  return { credentials: decryptCredentials(row.credentials), platform: row.platform };
}

const LANE_CALC: Record<string, { reach: string[]; interest: string[]; engagement: string[] }> = {
  github: { reach: ['traffic_views', 'traffic_uniques'], interest: ['stars', 'forks'], engagement: ['clones', 'clones_uniques'] },
  reddit: { reach: ['view_count'], interest: ['upvotes'], engagement: ['comment_count'] },
  ga4:    { reach: ['pageviews'], interest: ['users'], engagement: ['sessions'] },
  bing:   { reach: ['impressions'], interest: ['clicks'], engagement: [] },
};

function recalcDailyScores(trackedItemId: number, platform: string, date: string, columns: string[]): void {
  const table = `${platform}_daily`;
  const row = db.prepare(
    `SELECT ${columns.join(', ')} FROM ${table} WHERE tracked_item_id = ? AND period_start = ?`
  ).get(trackedItemId, date) as Record<string, number> | undefined;
  if (!row) return;

  const metrics: Record<string, number> = {};
  for (const col of columns) metrics[col] = row[col] ?? 0;

  // Recalculate interest score
  const interestScore = computeInterestScore(trackedItemId, platform, metrics);

  // Recalculate reach and engagement scores from lane mappings
  const lc = LANE_CALC[platform];
  const reachScore = lc ? lc.reach.reduce((s, k) => s + (metrics[k] ?? 0), 0) : 0;
  const engagementScore = lc ? lc.engagement.reduce((s, k) => s + (metrics[k] ?? 0), 0) : 0;

  db.prepare(
    `UPDATE ${table} SET reach_score = ?, interest_score = ?, engagement_score = ? WHERE tracked_item_id = ? AND period_start = ?`
  ).run(reachScore, interestScore, engagementScore, trackedItemId, date);
}

/** Backfill 14 days of GitHub traffic data for a tracked repo. */
async function backfillGithub(trackedItemId: number, accountId: number, platformIdentifier: string): Promise<void> {
  const acct = getAccountCredentials(accountId);
  if (!acct) return;
  const creds = acct.credentials as GithubCredentials;
  const { Octokit } = require('@octokit/rest');
  const octokit = new Octokit({ auth: creds.personalAccessToken });
  const [owner, repo] = platformIdentifier.split('/');
  if (!owner || !repo) return;

  // Get current repo stats (stars, forks, issues are point-in-time, not historical)
  const { data: repoData } = await octokit.repos.get({ owner, repo });

  // Traffic views by day (14-day max from GitHub)
  let viewsByDay: Record<string, { views: number; uniques: number }> = {};
  try {
    const { data: views } = await octokit.repos.getViews({ owner, repo, per: 'day' });
    for (const v of views.views || []) {
      const day = v.timestamp.split('T')[0];
      viewsByDay[day] = { views: v.count, uniques: v.uniques };
    }
  } catch { /* push access required */ }

  // Clones by day
  let clonesByDay: Record<string, { clones: number; uniques: number }> = {};
  try {
    const { data: clones } = await octokit.repos.getClones({ owner, repo, per: 'day' });
    for (const c of clones.clones || []) {
      const day = c.timestamp.split('T')[0];
      clonesByDay[day] = { clones: c.count, uniques: c.uniques };
    }
  } catch { /* push access required */ }

  const dates = getDates(LOOKBACK_DAYS);
  const columns = ['stars', 'forks', 'open_issues', 'traffic_views', 'traffic_uniques', 'clones', 'clones_uniques'];

  for (const date of dates) {
    const tv = viewsByDay[date] || { views: 0, uniques: 0 };
    const tc = clonesByDay[date] || { clones: 0, uniques: 0 };

    db.prepare(`
      INSERT OR IGNORE INTO github_daily
        (tracked_item_id, stars, forks, open_issues, traffic_views, traffic_uniques, clones, clones_uniques, reach_score, interest_score, engagement_score, period_start, period_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      trackedItemId,
      repoData.stargazers_count, repoData.forks_count, repoData.open_issues_count,
      tv.views, tv.uniques, tc.clones, tc.uniques,
      tv.views + tv.uniques, tc.clones + tc.uniques,
      date, date
    );

    recalcDailyScores(trackedItemId, 'github', date, columns);
    writeMetrics(trackedItemId, 'github', 'daily', date, date, {
      traffic_views: tv.views, traffic_uniques: tv.uniques,
      stars: repoData.stargazers_count, forks: repoData.forks_count,
      clones: tc.clones, clones_uniques: tc.uniques,
    });
  }

  console.log(`[Backfill] GitHub: inserted ${dates.length} daily rows for ${platformIdentifier}`);
}

/** Backfill 14 days of GA4 data for a tracked page. */
async function backfillGA4(trackedItemId: number, accountId: number, platformIdentifier: string): Promise<void> {
  const acct = getAccountCredentials(accountId);
  if (!acct) return;
  const creds = acct.credentials as GA4Credentials;
  const { BetaAnalyticsDataClient } = require('@google-analytics/data');
  const serviceAccount = JSON.parse(creds.serviceAccountJson);
  const client = new BetaAnalyticsDataClient({
    credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
    projectId: serviceAccount.project_id,
  });

  const dates = getDates(LOOKBACK_DAYS);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const reportRequest: any = {
    property: `properties/${creds.propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  };

  if (platformIdentifier && platformIdentifier !== creds.propertyId && !platformIdentifier.match(/^\d+$/)) {
    reportRequest.dimensionFilter = {
      filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: platformIdentifier } },
    };
  }

  const [response] = await client.runReport(reportRequest);
  const columns = ['sessions', 'pageviews', 'users', 'engagement_rate'];

  for (const row of response.rows || []) {
    const rawDate = row.dimensionValues?.[0]?.value; // YYYYMMDD
    if (!rawDate) continue;
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const m = row.metricValues || [];
    const sessions = m[0]?.value ? parseInt(m[0].value, 10) : 0;
    const pageviews = m[1]?.value ? parseInt(m[1].value, 10) : 0;
    const users = m[2]?.value ? parseInt(m[2].value, 10) : 0;
    const engagementRate = m[3]?.value ? parseFloat(m[3].value) : 0;

    db.prepare(`
      INSERT OR IGNORE INTO ga4_daily
        (tracked_item_id, sessions, pageviews, users, engagement_rate, reach_score, interest_score, engagement_score, period_start, period_end)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(trackedItemId, sessions, pageviews, users, engagementRate, pageviews, sessions, date, date);

    recalcDailyScores(trackedItemId, 'ga4', date, columns);
    writeMetrics(trackedItemId, 'ga4', 'daily', date, date, { pageviews, users, sessions, engagement_rate: engagementRate });
  }

  console.log(`[Backfill] GA4: inserted up to ${dates.length} daily rows for ${platformIdentifier}`);
}

/** Backfill 14 days of Bing data for a tracked page. */
async function backfillBing(trackedItemId: number, accountId: number, platformIdentifier: string): Promise<void> {
  const acct = getAccountCredentials(accountId);
  if (!acct) return;
  const creds = acct.credentials as BingCredentials;
  const axios = require('axios');

  const { data } = await axios.get('https://ssl.bing.com/webmaster/api.svc/json/GetPageStats', {
    params: { apikey: creds.apiKey, siteUrl: creds.siteUrl, page: platformIdentifier },
  });

  const entries = data?.d ?? data;
  const rows = Array.isArray(entries) ? entries : [entries];
  const columns = ['impressions', 'clicks', 'ctr', 'avg_rank'];

  for (const entry of rows) {
    // Bing returns dates as "/Date(1234567890000)/" format
    const dateMatch = entry.Date?.match(/\d+/);
    if (!dateMatch) continue;
    const date = new Date(parseInt(dateMatch[0])).toISOString().split('T')[0];

    const impressions = entry.Impressions ?? 0;
    const clicks = entry.Clicks ?? 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const avgRank = entry.AvgImpressionPosition ?? 0;

    db.prepare(`
      INSERT OR IGNORE INTO bing_daily
        (tracked_item_id, impressions, clicks, ctr, avg_rank, reach_score, interest_score, engagement_score, period_start, period_end)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(trackedItemId, impressions, clicks, ctr, avgRank, impressions, clicks, date, date);

    recalcDailyScores(trackedItemId, 'bing', date, columns);
    writeMetrics(trackedItemId, 'bing', 'daily', date, date, { impressions, clicks, ctr });
  }

  console.log(`[Backfill] Bing: inserted daily rows for ${platformIdentifier}`);
}

/** Run historical backfill for a newly tracked item. Fire-and-forget. */
export async function runHistoricalBackfill(trackedItemId: number, accountId: number, platform: string, platformIdentifier: string): Promise<void> {
  insertPollLog({ metric_account_id: accountId, tracked_item_id: trackedItemId, platform, level: 'info', message: `Backfill started for ${platformIdentifier} (${LOOKBACK_DAYS} days)` });
  try {
    switch (platform) {
      case 'github': await backfillGithub(trackedItemId, accountId, platformIdentifier); break;
      case 'ga4':    await backfillGA4(trackedItemId, accountId, platformIdentifier); break;
      case 'bing':   await backfillBing(trackedItemId, accountId, platformIdentifier); break;
      // Reddit has no historical API
    }
    insertPollLog({ metric_account_id: accountId, tracked_item_id: trackedItemId, platform, level: 'info', message: `Backfill completed for ${platformIdentifier}` });
  } catch (err: any) {
    console.error(`[Backfill] Failed for ${platform} item ${trackedItemId}: ${err.message}`);
    insertPollLog({ metric_account_id: accountId, tracked_item_id: trackedItemId, platform, level: 'error', message: `Backfill failed for ${platformIdentifier}: ${err.message}` });
  }
}
