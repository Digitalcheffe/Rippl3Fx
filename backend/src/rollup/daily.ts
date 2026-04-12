import db from '../db/connection';
import { insertGithubDaily, insertRedditDaily } from '../db/queries/rollup';
import { computeInterestScore } from '../lanes/score';
import { decryptCredentials } from '../crypto/credentials';
import { getYesterdayDate } from '../utils/timezone';
import type { GA4Credentials, BingCredentials } from '../types';

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

/** Fetch GA4 finalized data for a specific date directly from the API. */
async function fetchGA4Daily(trackedItemId: number, accountId: number, platformIdentifier: string, date: string): Promise<void> {
  const account = db.prepare('SELECT credentials FROM metric_accounts WHERE id = ?').get(accountId) as { credentials: string } | undefined;
  if (!account) return;

  const creds = decryptCredentials(account.credentials) as GA4Credentials;
  const { BetaAnalyticsDataClient } = require('@google-analytics/data');
  const serviceAccount = JSON.parse(creds.serviceAccountJson);
  const client = new BetaAnalyticsDataClient({
    credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
    projectId: serviceAccount.project_id,
  });

  const reportRequest: any = {
    property: `properties/${creds.propertyId}`,
    dateRanges: [{ startDate: date, endDate: date }],
    metrics: [
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'totalUsers' },
      { name: 'engagementRate' },
    ],
  };

  // Filter by page path if identifier is a path
  if (platformIdentifier && platformIdentifier !== creds.propertyId && !platformIdentifier.match(/^\d+$/)) {
    reportRequest.dimensionFilter = {
      filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: platformIdentifier } },
    };
  }

  const [response] = await client.runReport(reportRequest);
  const row = response.rows?.[0];
  const m = row?.metricValues;

  const sessions = m?.[0]?.value ? parseInt(m[0].value, 10) : 0;
  const pageviews = m?.[1]?.value ? parseInt(m[1].value, 10) : 0;
  const users = m?.[2]?.value ? parseInt(m[2].value, 10) : 0;
  const engagementRate = m?.[3]?.value ? parseFloat(m[3].value) : 0;

  db.prepare(`
    INSERT OR REPLACE INTO ga4_daily
      (tracked_item_id, sessions, pageviews, users, engagement_rate, reach_score, interest_score, engagement_score, period_start, period_end)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(trackedItemId, sessions, pageviews, users, engagementRate, pageviews, sessions, date, date);
}

/** Fetch Bing finalized data for a specific date directly from the API. */
async function fetchBingDaily(trackedItemId: number, accountId: number, platformIdentifier: string, date: string): Promise<void> {
  const account = db.prepare('SELECT credentials FROM metric_accounts WHERE id = ?').get(accountId) as { credentials: string } | undefined;
  if (!account) return;

  const creds = decryptCredentials(account.credentials) as BingCredentials;
  const axios = require('axios');

  const { data } = await axios.get('https://ssl.bing.com/webmaster/api.svc/json/GetPageStats', {
    params: { apikey: creds.apiKey, siteUrl: creds.siteUrl, page: platformIdentifier },
  });

  const entries = data?.d ?? data;
  const rows = Array.isArray(entries) ? entries : [entries];

  // Filter to just the rollup date
  let impressions = 0, clicks = 0, totalRank = 0, rankCount = 0;
  for (const entry of rows) {
    const entryDate = entry.Date ? new Date(parseInt(entry.Date.match(/\d+/)?.[0] || '0')).toISOString().split('T')[0] : null;
    if (entryDate && entryDate !== date) continue;
    impressions += entry.Impressions ?? 0;
    clicks += entry.Clicks ?? 0;
    if (entry.AvgImpressionPosition != null) {
      totalRank += entry.AvgImpressionPosition;
      rankCount++;
    }
  }

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const avgRank = rankCount > 0 ? totalRank / rankCount : 0;

  db.prepare(`
    INSERT OR REPLACE INTO bing_daily
      (tracked_item_id, impressions, clicks, ctr, avg_rank, reach_score, interest_score, engagement_score, period_start, period_end)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(trackedItemId, impressions, clicks, ctr, avgRank, impressions, clicks, date, date);
}

export async function runDailyRollup(date?: string): Promise<void> {
  const rollupDate = date || getYesterdayDate();
  console.log(`[Rollup] Running daily rollup for ${rollupDate}`);

  const items = db.prepare(`
    SELECT ti.id, ti.metric_account_id, ti.platform_identifier, ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
    WHERE ti.is_active = 1
  `).all() as Array<{ id: number; metric_account_id: number; platform_identifier: string; platform: string }>;

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
          await fetchGA4Daily(item.id, item.metric_account_id, item.platform_identifier, rollupDate);
          break;
        case 'bing':
          await fetchBingDaily(item.id, item.metric_account_id, item.platform_identifier, rollupDate);
          break;
      }
      updateDailyInterestScore(item.id, item.platform, rollupDate);
      count++;
    } catch (err: any) {
      console.error(`[Rollup] Failed daily rollup for item ${item.id} (${item.platform}): ${err.message}`);
    }
  }

  console.log(`[Rollup] Daily rollup complete — processed ${count} items`);
}
