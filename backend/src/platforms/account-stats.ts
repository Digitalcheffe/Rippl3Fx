import db from '../db/connection';
import { Octokit } from '@octokit/rest';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import axios from 'axios';
import { getLocalDate } from '../utils/timezone';
import { calcPerformanceScore, updatePeaks } from '../lanes/unify';
import { getPerformanceWeights } from '../routes/performance';
import type { GithubCredentials, GA4Credentials, BingCredentials } from '../types';

interface LaneValues { reach: number; interest: number; engagement: number }

function writeAccountUnified(platform: string, lanes: LaneValues): void {
  const perf = calcPerformanceScore(lanes);
  const today = getLocalDate();

  db.prepare(`
    INSERT INTO unified_metrics (platform, period_type, period_start, period_end, reach_value, interest_value, engagement_value, performance_score)
    VALUES (?, 'daily', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, period_type, period_start) DO UPDATE SET
      reach_value = excluded.reach_value,
      interest_value = excluded.interest_value,
      engagement_value = excluded.engagement_value,
      performance_score = excluded.performance_score
  `).run(platform, today, today, lanes.reach, lanes.interest, lanes.engagement, perf);

  updatePeaks(null, platform, 'daily', today, lanes);
}

export async function collectAccountStats(accountId: number, platform: string, credentials: any): Promise<{ success: boolean; lanes?: LaneValues; error?: string }> {
  try {
    let lanes: LaneValues = { reach: 0, interest: 0, engagement: 0 };

    switch (platform) {
      case 'github': {
        const creds = credentials as GithubCredentials;
        const octokit = new Octokit({ auth: creds.personalAccessToken });
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, type: 'owner' });

        let totalTrafficViews = 0;
        let totalStars = 0;
        let totalWatchers = 0;
        let totalForks = 0;
        let totalClones = 0;
        let totalReleaseDownloads = 0;

        for (const repo of repos) {
          totalStars += repo.stargazers_count || 0;
          totalForks += repo.forks_count || 0;
          totalWatchers += (repo as any).subscribers_count || 0;

          // Traffic (requires push access, may 403)
          try {
            const { data: views } = await octokit.repos.getViews({ owner: repo.owner.login, repo: repo.name, per: 'day' });
            totalTrafficViews += views.count || 0;
          } catch { /* no access */ }

          // Clones
          try {
            const { data: clones } = await octokit.repos.getClones({ owner: repo.owner.login, repo: repo.name, per: 'day' });
            totalClones += clones.count || 0;
          } catch { /* no access */ }

          // Release downloads
          try {
            const { data: releases } = await octokit.repos.listReleases({ owner: repo.owner.login, repo: repo.name, per_page: 100 });
            for (const release of releases) {
              for (const asset of release.assets || []) {
                totalReleaseDownloads += asset.download_count || 0;
              }
            }
          } catch { /* ignore */ }
        }

        lanes = {
          reach: totalTrafficViews,
          interest: totalStars + totalWatchers,
          engagement: totalForks + totalClones + totalReleaseDownloads,
        };
        break;
      }

      case 'ga4': {
        const creds = credentials as GA4Credentials;
        const serviceAccount = JSON.parse(creds.serviceAccountJson);
        const client = new BetaAnalyticsDataClient({
          credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
          projectId: serviceAccount.project_id,
        });

        const [response] = await client.runReport({
          property: `properties/${creds.propertyId}`,
          dateRanges: [{ startDate: 'today', endDate: 'today' }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'sessions' },
          ],
        });

        const row = response.rows?.[0];
        const m = row?.metricValues;
        lanes = {
          reach: m?.[0]?.value ? parseInt(m[0].value, 10) : 0,
          interest: m?.[1]?.value ? parseInt(m[1].value, 10) : 0,
          engagement: m?.[2]?.value ? parseInt(m[2].value, 10) : 0,
        };
        break;
      }

      case 'bing': {
        const creds = credentials as BingCredentials;
        const { data } = await axios.get('https://ssl.bing.com/webmaster/api.svc/json/GetPageStats', {
          params: { apikey: creds.apiKey, siteUrl: creds.siteUrl },
        });

        const entries = data?.d ?? data;
        if (Array.isArray(entries)) {
          let impressions = 0, clicks = 0, totalCtr = 0, ctrCount = 0;
          for (const entry of entries) {
            impressions += entry.Impressions ?? 0;
            clicks += entry.Clicks ?? 0;
            if (entry.Impressions > 0) {
              totalCtr += (entry.Clicks ?? 0) / entry.Impressions;
              ctrCount++;
            }
          }
          const avgCtr = ctrCount > 0 ? totalCtr / ctrCount : 0;
          lanes = {
            reach: impressions,
            interest: clicks,
            engagement: Math.round(avgCtr * 10000) / 100,
          };
        }
        break;
      }
    }

    writeAccountUnified(platform, lanes);
    console.log(`[AccountStats] Collected ${platform} account-level: reach=${lanes.reach} interest=${lanes.interest} engagement=${lanes.engagement}`);
    return { success: true, lanes };
  } catch (err: any) {
    console.error(`[AccountStats] Failed ${platform}: ${err.message}`);
    return { success: false, error: err.message };
  }
}
