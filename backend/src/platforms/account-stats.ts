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

const BACKFILL_DAYS = 14;

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function writeUnifiedRow(platform: string, periodType: string, periodStart: string, periodEnd: string, lanes: LaneValues): void {
  const perf = calcPerformanceScore(lanes);
  db.prepare(`
    INSERT INTO unified_metrics (platform, period_type, period_start, period_end, reach_value, interest_value, engagement_value, performance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, period_type, period_start) DO UPDATE SET
      reach_value = excluded.reach_value, interest_value = excluded.interest_value,
      engagement_value = excluded.engagement_value, performance_score = excluded.performance_score
  `).run(platform, periodType, periodStart, periodEnd, lanes.reach, lanes.interest, lanes.engagement, perf);
  updatePeaks(null, platform, periodType, periodStart, lanes);
}

/** Backfill 14 days of account-level daily data, then roll up weekly/monthly. */
export async function backfillAccountStats(accountId: number, platform: string, credentials: any): Promise<void> {
  console.log(`[AccountStats] Backfilling ${platform} account-level (${BACKFILL_DAYS} days)`);

  const dailyData: Array<{ date: string; lanes: LaneValues }> = [];

  try {
    switch (platform) {
      case 'github': {
        const creds = credentials as GithubCredentials;
        const octokit = new Octokit({ auth: creds.personalAccessToken });
        const { data: repos } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, type: 'owner' });

        // Get current cumulative stats (stars, forks, watchers — same every day)
        const totalStars = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
        const totalForks = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
        const totalWatchers = repos.reduce((s, r) => s + ((r as any).subscribers_count || 0), 0);

        // Traffic views by day (aggregated across all repos)
        const viewsByDay: Record<string, number> = {};
        const clonesByDay: Record<string, number> = {};

        for (const repo of repos) {
          try {
            const { data: views } = await octokit.repos.getViews({ owner: repo.owner.login, repo: repo.name, per: 'day' });
            for (const v of views.views || []) {
              const day = v.timestamp.split('T')[0];
              viewsByDay[day] = (viewsByDay[day] || 0) + v.count;
            }
          } catch { /* no access */ }

          try {
            const { data: clones } = await octokit.repos.getClones({ owner: repo.owner.login, repo: repo.name, per: 'day' });
            for (const c of clones.clones || []) {
              const day = c.timestamp.split('T')[0];
              clonesByDay[day] = (clonesByDay[day] || 0) + c.count;
            }
          } catch { /* no access */ }
        }

        // Release downloads (cumulative, same every day)
        let totalReleaseDownloads = 0;
        for (const repo of repos) {
          try {
            const { data: releases } = await octokit.repos.listReleases({ owner: repo.owner.login, repo: repo.name, per_page: 100 });
            for (const release of releases) {
              for (const asset of release.assets || []) totalReleaseDownloads += asset.download_count || 0;
            }
          } catch { /* ignore */ }
        }

        // Build daily rows — incremental metrics per day, cumulative only on today
        const today = getLocalDate();
        for (let i = BACKFILL_DAYS; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86_400_000);
          const date = getLocalDate(d);
          const isToday = date === today;
          dailyData.push({
            date,
            lanes: {
              reach: viewsByDay[date] || 0,
              interest: isToday ? totalStars + totalWatchers : 0, // cumulative only on today
              engagement: (isToday ? totalForks : 0) + (clonesByDay[date] || 0) + (isToday ? totalReleaseDownloads : 0),
            },
          });
        }
        break;
      }

      case 'ga4': {
        const creds = credentials as GA4Credentials;
        const serviceAccount = JSON.parse(creds.serviceAccountJson);
        const client = new BetaAnalyticsDataClient({
          credentials: { client_email: serviceAccount.client_email, private_key: serviceAccount.private_key },
          projectId: serviceAccount.project_id,
        });

        const startDate = getLocalDate(new Date(Date.now() - BACKFILL_DAYS * 86_400_000));
        const endDate = getLocalDate();

        const [response] = await client.runReport({
          property: `properties/${creds.propertyId}`,
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'sessions' },
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        });

        for (const row of response.rows || []) {
          const rawDate = row.dimensionValues?.[0]?.value;
          if (!rawDate) continue;
          const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
          const m = row.metricValues || [];
          dailyData.push({
            date,
            lanes: {
              reach: m[0]?.value ? parseInt(m[0].value, 10) : 0,
              interest: m[1]?.value ? parseInt(m[1].value, 10) : 0,
              engagement: m[2]?.value ? parseInt(m[2].value, 10) : 0,
            },
          });
        }
        break;
      }

      case 'bing': {
        const creds = credentials as BingCredentials;
        const { data } = await axios.get('https://ssl.bing.com/webmaster/api.svc/json/GetPageStats', {
          params: { apikey: creds.apiKey, siteUrl: creds.siteUrl },
        });

        const entries = data?.d ?? data;
        if (Array.isArray(entries)) {
          // Aggregate by date across all pages
          const byDay: Record<string, { impressions: number; clicks: number }> = {};
          for (const entry of entries) {
            const dateMatch = entry.Date?.match(/\d+/);
            if (!dateMatch) continue;
            const date = new Date(parseInt(dateMatch[0])).toISOString().split('T')[0];
            if (!byDay[date]) byDay[date] = { impressions: 0, clicks: 0 };
            byDay[date].impressions += entry.Impressions ?? 0;
            byDay[date].clicks += entry.Clicks ?? 0;
          }
          for (const [date, vals] of Object.entries(byDay)) {
            const ctr = vals.impressions > 0 ? vals.clicks / vals.impressions : 0;
            dailyData.push({
              date,
              lanes: {
                reach: vals.impressions,
                interest: vals.clicks,
                engagement: Math.round(ctr * 10000) / 100,
              },
            });
          }
        }
        break;
      }
    }

    // Write daily rows
    for (const { date, lanes } of dailyData) {
      writeUnifiedRow(platform, 'daily', date, date, lanes);
    }

    // Roll up weekly
    const weeks: Record<string, LaneValues> = {};
    for (const { date, lanes } of dailyData) {
      const mon = getMonday(date);
      if (!weeks[mon]) weeks[mon] = { reach: 0, interest: 0, engagement: 0 };
      weeks[mon].reach += lanes.reach;
      weeks[mon].interest += lanes.interest;
      weeks[mon].engagement += lanes.engagement;
    }
    for (const [mon, lanes] of Object.entries(weeks)) {
      const sun = new Date(new Date(mon + 'T12:00:00').getTime() + 6 * 86_400_000).toISOString().split('T')[0];
      writeUnifiedRow(platform, 'weekly', mon, sun, lanes);
    }

    // Roll up monthly
    const months: Record<string, LaneValues> = {};
    for (const { date, lanes } of dailyData) {
      const ym = date.slice(0, 7);
      if (!months[ym]) months[ym] = { reach: 0, interest: 0, engagement: 0 };
      months[ym].reach += lanes.reach;
      months[ym].interest += lanes.interest;
      months[ym].engagement += lanes.engagement;
    }
    for (const [ym, lanes] of Object.entries(months)) {
      const start = ym + '-01';
      const [y, m] = ym.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${ym}-${String(lastDay).padStart(2, '0')}`;
      writeUnifiedRow(platform, 'monthly', start, end, lanes);
    }

    console.log(`[AccountStats] Backfill complete: ${dailyData.length} daily, ${Object.keys(weeks).length} weekly, ${Object.keys(months).length} monthly`);
  } catch (err: any) {
    console.error(`[AccountStats] Backfill failed for ${platform}: ${err.message}`);
  }
}
