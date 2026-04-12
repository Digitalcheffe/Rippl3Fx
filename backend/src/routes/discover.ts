import { Router, Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import Snoowrap from 'snoowrap';
import axios from 'axios';
import db from '../db/connection';
import { decryptCredentials } from '../crypto/credentials';
import type { GithubCredentials, RedditCredentials, GA4Credentials, BingCredentials } from '../types';

const router = Router();

// GET /api/accounts/:id/discover — list browsable content for an account
router.get('/:id/discover', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const account = db.prepare('SELECT * FROM metric_accounts WHERE id = ?').get(id) as any;
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  let credentials: any;
  try {
    credentials = decryptCredentials(account.credentials);
  } catch {
    res.status(500).json({ error: 'Failed to decrypt credentials' });
    return;
  }

  try {
    let items: Array<{ name: string; identifier: string; description?: string }> = [];

    switch (account.platform) {
      case 'github': {
        const creds = credentials as GithubCredentials;
        const octokit = new Octokit({ auth: creds.personalAccessToken });
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 30,
          type: 'owner',
        });
        items = repos.map(r => ({
          name: r.full_name,
          identifier: r.full_name,
          description: `${r.stargazers_count} stars · ${r.language || 'no language'}`,
        }));
        break;
      }

      case 'reddit': {
        const creds = credentials as RedditCredentials;
        const reddit = new Snoowrap({
          userAgent: 'Rippl3FX/1.0',
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          username: creds.username,
          password: creds.password,
        });
        const submissions = await (reddit.getMe().getSubmissions({ limit: 25 }) as any);
        items = submissions.map((s: any) => ({
          name: `r/${s.subreddit.display_name} — ${s.title}`,
          identifier: `https://reddit.com${s.permalink}`,
          description: `${s.score} points · ${s.num_comments} comments`,
        }));
        break;
      }

      case 'ga4': {
        const creds = credentials as GA4Credentials;
        // Pull top pages from GA4 Data API
        try {
          const { BetaAnalyticsDataClient } = require('@google-analytics/data');
          const serviceAccount = JSON.parse(creds.serviceAccountJson);
          const client = new BetaAnalyticsDataClient({
            credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
            projectId: serviceAccount.project_id,
          });
          const [response] = await client.runReport({
            property: `properties/${creds.propertyId}`,
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }],
            metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: 20,
          });
          items = (response.rows || []).map((row: any) => {
            const path = row.dimensionValues?.[0]?.value || '/';
            const views = row.metricValues?.[0]?.value || '0';
            const users = row.metricValues?.[1]?.value || '0';
            return {
              name: path,
              identifier: path,
              description: `${fmtNum(parseInt(views))} views · ${fmtNum(parseInt(users))} users`,
            };
          });
        } catch (err: any) {
          // Fallback to property ID
          items = [{
            name: `GA4 Property ${creds.propertyId}`,
            identifier: creds.propertyId,
            description: `Discovery failed: ${err.message}`,
          }];
        }
        break;
      }

      case 'bing': {
        const creds = credentials as BingCredentials;
        // Fetch top pages with search stats from Bing Webmaster API
        try {
          const { data } = await axios.get('https://ssl.bing.com/webmaster/api.svc/json/GetPageStats', {
            params: { apikey: creds.apiKey, siteUrl: creds.siteUrl },
          });
          const entries = data?.d ?? data;
          if (Array.isArray(entries) && entries.length > 0) {
            // Aggregate by page URL (entries are daily rows)
            const pageMap = new Map<string, { impressions: number; clicks: number }>();
            for (const entry of entries) {
              const url = entry.Query || entry.query || entry.Url || entry.url;
              if (!url) continue;
              const existing = pageMap.get(url) || { impressions: 0, clicks: 0 };
              existing.impressions += entry.Impressions ?? 0;
              existing.clicks += entry.Clicks ?? 0;
              pageMap.set(url, existing);
            }
            items = Array.from(pageMap.entries())
              .sort((a, b) => b[1].impressions - a[1].impressions)
              .slice(0, 30)
              .map(([url, stats]) => ({
                name: '/' + url.replace(/^https?:\/\/[^/]+\/?/, ''),
                identifier: url,
                description: `${fmtNum(stats.impressions)} impressions · ${fmtNum(stats.clicks)} clicks`,
              }));
          }
        } catch {
          // Fallback to credential siteUrl
          items = [{
            name: creds.siteUrl,
            identifier: creds.siteUrl,
            description: 'Configured site URL',
          }];
        }
        break;
      }
    }

    // Filter out already-tracked items
    const tracked = db.prepare(
      'SELECT platform_identifier FROM tracked_items WHERE metric_account_id = ?'
    ).all(id) as Array<{ platform_identifier: string }>;
    const trackedSet = new Set(tracked.map(t => t.platform_identifier));

    const discoverable = items.map(i => ({
      ...i,
      already_tracked: trackedSet.has(i.identifier),
    }));

    res.json(discoverable);
  } catch (err: any) {
    res.status(500).json({ error: `Discovery failed: ${err.message}` });
  }
});

// GET /api/accounts/:id/stats — account-level overview stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const account = db.prepare('SELECT * FROM metric_accounts WHERE id = ?').get(id) as any;
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  let credentials: any;
  try {
    credentials = decryptCredentials(account.credentials);
  } catch {
    res.status(500).json({ error: 'Failed to decrypt credentials' });
    return;
  }

  try {
    let stats: Array<{ label: string; value: string }> = [];

    switch (account.platform) {
      case 'github': {
        const creds = credentials as GithubCredentials;
        const octokit = new Octokit({ auth: creds.personalAccessToken });
        const { data: user } = await octokit.users.getAuthenticated();
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, type: 'owner' });
        const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
        const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
        stats = [
          { label: 'Total Stars', value: fmtNum(totalStars) },
          { label: 'Total Forks', value: fmtNum(totalForks) },
          { label: 'Followers', value: fmtNum(user.followers) },
          { label: 'Public Repos', value: fmtNum(user.public_repos) },
        ];
        break;
      }

      case 'reddit': {
        const creds = credentials as RedditCredentials;
        const reddit = new Snoowrap({
          userAgent: 'Rippl3FX/1.0',
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          username: creds.username,
          password: creds.password,
        });
        const me = await (reddit.getMe() as any);
        stats = [
          { label: 'Post Karma', value: fmtNum(me.link_karma) },
          { label: 'Comment Karma', value: fmtNum(me.comment_karma) },
          { label: 'Account Age', value: `${Math.floor((Date.now() / 1000 - me.created_utc) / 86400 / 365)} yrs` },
        ];
        break;
      }

      case 'ga4': {
        const creds = credentials as GA4Credentials;
        // Aggregate from collected snapshots
        const ga4Totals = db.prepare(`
          SELECT SUM(sessions) as sessions, SUM(pageviews) as pageviews, SUM(users) as users,
                 AVG(engagement_rate) as engagement_rate
          FROM ga4_snapshots gs
          JOIN tracked_items ti ON gs.tracked_item_id = ti.id
          WHERE ti.metric_account_id = ?
        `).get(id) as any;
        stats = [
          { label: 'Property ID', value: creds.propertyId },
          { label: 'Total Sessions', value: fmtNum(ga4Totals?.sessions || 0) },
          { label: 'Total Pageviews', value: fmtNum(ga4Totals?.pageviews || 0) },
          { label: 'Total Users', value: fmtNum(ga4Totals?.users || 0) },
        ];
        if (ga4Totals?.engagement_rate) {
          stats.push({ label: 'Avg Engagement', value: `${(ga4Totals.engagement_rate * 100).toFixed(1)}%` });
        }
        break;
      }

      case 'bing': {
        const creds = credentials as BingCredentials;
        const bingTotals = db.prepare(`
          SELECT SUM(impressions) as impressions, SUM(clicks) as clicks,
                 AVG(ctr) as ctr, AVG(avg_rank) as avg_rank
          FROM bing_snapshots bs
          JOIN tracked_items ti ON bs.tracked_item_id = ti.id
          WHERE ti.metric_account_id = ?
        `).get(id) as any;
        stats = [
          { label: 'Site URL', value: creds.siteUrl },
          { label: 'Total Impressions', value: fmtNum(bingTotals?.impressions || 0) },
          { label: 'Total Clicks', value: fmtNum(bingTotals?.clicks || 0) },
        ];
        if (bingTotals?.avg_rank) {
          stats.push({ label: 'Avg Rank', value: bingTotals.avg_rank.toFixed(1) });
        }
        break;
      }
    }

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: `Stats failed: ${err.message}` });
  }
});

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default router;
