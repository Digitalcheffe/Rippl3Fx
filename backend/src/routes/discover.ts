import { Router, Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import axios from 'axios';
import db from '../db/connection';
import { decryptCredentials } from '../crypto/credentials';
import { asyncHandler } from '../middleware/asyncHandler';
import type { GithubCredentials, GA4Credentials, BingCredentials } from '../types';
import { apiLimiter } from '../middleware/rateLimiter';
import { doubleCsrfProtection } from '../middleware/csrf';

const router = Router();
router.use(apiLimiter);
router.use(doubleCsrfProtection);

// GET /api/accounts/:id/discover — list browsable content for an account
router.get('/:id/discover', asyncHandler(async (req: Request, res: Response) => {
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
              const url = entry.Query || entry.query || entry.Page || entry.page || entry.Url || entry.url;
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
}));

// GET /api/accounts/:id/stats — account-level overview stats
router.get('/:id/stats', asyncHandler(async (req: Request, res: Response) => {
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
        const totalWatchers = repos.reduce((s, r) => s + ((r as any).subscribers_count || 0), 0);

        // Peak values from unified_metrics (platform-level)
        const ghPeaks = db.prepare(`
          SELECT MAX(reach_value) as peak_reach, MAX(engagement_value) as peak_engagement
          FROM unified_metrics WHERE platform = 'github' AND period_type = 'daily'
        `).get() as any;

        // Count releases across tracked repos
        let totalReleases = 0;
        try {
          for (const r of repos) {
            if (r.name) {
              try {
                const { data: releases } = await octokit.repos.listReleases({ owner: user.login, repo: r.name, per_page: 100 });
                totalReleases += releases.length;
              } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }

        stats = [
          { label: 'Peak Traffic Views', value: fmtNum(ghPeaks?.peak_reach || 0) },
          { label: 'Total Stars', value: fmtNum(totalStars) },
          { label: 'Watchers', value: fmtNum(totalWatchers) },
          { label: 'Total Forks', value: fmtNum(totalForks) },
          { label: 'Peak Clones', value: fmtNum(ghPeaks?.peak_engagement || 0) },
          { label: 'Releases', value: fmtNum(totalReleases) },
          { label: 'Public Repos', value: fmtNum(user.public_repos) },
        ];
        break;
      }

      case 'ga4': {
        const creds = credentials as GA4Credentials;
        const ga4Peaks = db.prepare(`
          SELECT MAX(reach_value) as peak_reach, MAX(interest_value) as peak_interest, MAX(engagement_value) as peak_engagement
          FROM unified_metrics WHERE platform = 'ga4' AND period_type = 'daily'
        `).get() as any;
        stats = [
          { label: 'Property ID', value: creds.propertyId },
          { label: 'Peak Pageviews', value: fmtNum(ga4Peaks?.peak_reach || 0) },
          { label: 'Peak Users', value: fmtNum(ga4Peaks?.peak_interest || 0) },
          { label: 'Peak Sessions', value: fmtNum(ga4Peaks?.peak_engagement || 0) },
        ];
        break;
      }

      case 'bing': {
        const creds = credentials as BingCredentials;
        const bingPeaks = db.prepare(`
          SELECT MAX(reach_value) as peak_reach, MAX(interest_value) as peak_interest, MAX(engagement_value) as peak_engagement
          FROM unified_metrics WHERE platform = 'bing' AND period_type = 'daily'
        `).get() as any;
        stats = [
          { label: 'Site URL', value: creds.siteUrl },
          { label: 'Peak Impressions', value: fmtNum(bingPeaks?.peak_reach || 0) },
          { label: 'Peak Clicks', value: fmtNum(bingPeaks?.peak_interest || 0) },
        ];
        break;
      }
    }

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: `Stats failed: ${err.message}` });
  }
}));

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default router;
