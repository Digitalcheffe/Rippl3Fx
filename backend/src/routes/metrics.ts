import { Router, Request, Response } from 'express';
import { getTrackedItemsWithPlatform, getTagsForItem, getLatestSnapshot } from '../db/queries/metrics';
import { getTrackedPair, getTrackedHistory, getHourlyPair, getHourlyHistory } from '../db/queries/tracked';
import { getUnifiedPair, getUnifiedHistory, getUnifiedHourlyPair, getUnifiedHourlyHistory } from '../db/queries/unified';
import { getPerformanceWeights } from './performance';
import { getPeaks } from '../lanes/unify';
import { asyncHandler } from '../middleware/asyncHandler';
import { apiLimiter } from '../middleware/rateLimiter';
import { doubleCsrfProtection } from '../middleware/csrf';

const router = Router();
router.use(apiLimiter);
router.use(doubleCsrfProtection);

// GET /api/dashboard?tag=NORA&range=daily
router.get('/dashboard', asyncHandler((req: Request, res: Response) => {
  const tagFilter = req.query.tag as string | undefined;
  const range = (req.query.range as string) || 'daily';
  const trackedItems = getTrackedItemsWithPlatform(tagFilter);
  const weights = getPerformanceWeights();

  const items = trackedItems.map(ti => {
    // Get current + previous — hourly reads from tracked_hourly_metrics, others from tracked_metrics
    const { current, previous } = range === 'hourly'
      ? getHourlyPair(ti.id)
      : getTrackedPair(ti.id, range);

    // Lane values from tracked_metrics (same numbers shown in UI)
    const reach = current?.reach_value ?? 0;
    const interest = current?.interest_value ?? 0;
    const engagement = current?.engagement_value ?? 0;
    const performanceScore = current?.performance_score ?? 0;

    // Velocity = current - previous
    const velocity = {
      reach: reach - (previous?.reach_value ?? 0),
      interest: interest - (previous?.interest_value ?? 0),
      engagement: engagement - (previous?.engagement_value ?? 0),
    };
    const performanceVelocity = performanceScore - (previous?.performance_score ?? 0);

    // History arrays for charts (last 24 hours for hourly, last 7 periods otherwise)
    const historyLimit = range === 'hourly' ? 24 : 7;
    const history = (range === 'hourly'
      ? getHourlyHistory(ti.id, historyLimit)
      : getTrackedHistory(ti.id, range, historyLimit)
    ).reverse();
    const reachHistory = history.map(r => r.reach_value ?? 0);
    const interestHistory = history.map(r => r.interest_value ?? 0);
    const engagementHistory = history.map(r => r.engagement_value ?? 0);
    const performanceHistory = history.map(r => r.performance_score ?? 0);

    // Pad to expected length if less
    const padLen = range === 'hourly' ? 24 : 7;
    while (reachHistory.length < padLen) reachHistory.unshift(0);
    while (interestHistory.length < padLen) interestHistory.unshift(0);
    while (engagementHistory.length < padLen) engagementHistory.unshift(0);
    while (performanceHistory.length < padLen) performanceHistory.unshift(0);

    // Still provide latestSnapshot for platform-specific detail views
    const latestSnapshot = getLatestSnapshot(ti.id, ti.platform);

    return {
      id: ti.id,
      platform: ti.platform,
      display_name: ti.display_name,
      platform_identifier: ti.platform_identifier,
      tags: getTagsForItem(ti.id),
      latestSnapshot,
      // Lane values (raw, same as UI cards)
      reach,
      interest,
      engagement,
      performanceScore: Math.round(performanceScore * 100) / 100,
      // Velocity
      velocity,
      performanceVelocity: Math.round(performanceVelocity * 100) / 100,
      // Period info (for date labels — especially weekly/monthly fallback)
      periodStart: current?.period_start ?? null,
      periodEnd: current?.period_end ?? null,
      // History for charts
      reachHistory,
      interestHistory,
      engagementHistory,
      performanceHistory,
      // Peak values for this item
      peaks: getPeaks(ti.id, ti.platform, range === 'hourly' ? 'daily' : range),
    };
  });

  // Platform-level data: from unified_metrics when no tag filter, from items when tag-filtered
  const platforms: Record<string, any> = {};
  if (tagFilter) {
    // Tag-filtered: compute platform totals from filtered items
    for (const item of items) {
      const p = item.platform;
      if (!platforms[p]) {
        platforms[p] = { reach: 0, interest: 0, engagement: 0, performanceScore: 0, velocity: { reach: 0, interest: 0, engagement: 0 }, performanceVelocity: 0 };
      }
      platforms[p].reach += item.reach;
      platforms[p].interest += item.interest;
      platforms[p].engagement += item.engagement;
      platforms[p].performanceScore += item.performanceScore;
      platforms[p].velocity.reach += item.velocity.reach;
      platforms[p].velocity.interest += item.velocity.interest;
      platforms[p].velocity.engagement += item.velocity.engagement;
      platforms[p].performanceVelocity += item.performanceVelocity;
    }
  } else if (range === 'hourly') {
    // Hourly: read from unified_tracked_hourly_metrics (account-level)
    for (const p of ['github', 'ga4', 'bing']) {
      const { current, previous } = getUnifiedHourlyPair(p);
      if (current) {
        platforms[p] = {
          reach: current.reach_value ?? 0,
          interest: current.interest_value ?? 0,
          engagement: current.engagement_value ?? 0,
          performanceScore: Math.round((current.performance_score ?? 0) * 100) / 100,
          velocity: {
            reach: (current.reach_value ?? 0) - (previous?.reach_value ?? 0),
            interest: (current.interest_value ?? 0) - (previous?.interest_value ?? 0),
            engagement: (current.engagement_value ?? 0) - (previous?.engagement_value ?? 0),
          },
          performanceVelocity: Math.round(((current.performance_score ?? 0) - (previous?.performance_score ?? 0)) * 100) / 100,
        };
      } else {
        platforms[p] = { reach: 0, interest: 0, engagement: 0, performanceScore: 0, velocity: { reach: 0, interest: 0, engagement: 0 }, performanceVelocity: 0 };
      }
    }
  } else {
    // Daily/weekly/monthly: use unified_metrics (platform-wide totals)
    for (const p of ['github', 'ga4', 'bing']) {
      const { current, previous } = getUnifiedPair(p, range);
      if (current) {
        platforms[p] = {
          reach: current.reach_value ?? 0,
          interest: current.interest_value ?? 0,
          engagement: current.engagement_value ?? 0,
          performanceScore: Math.round((current.performance_score ?? 0) * 100) / 100,
          velocity: {
            reach: (current.reach_value ?? 0) - (previous?.reach_value ?? 0),
            interest: (current.interest_value ?? 0) - (previous?.interest_value ?? 0),
            engagement: (current.engagement_value ?? 0) - (previous?.engagement_value ?? 0),
          },
          performanceVelocity: Math.round(((current.performance_score ?? 0) - (previous?.performance_score ?? 0)) * 100) / 100,
          periodStart: current.period_start ?? null,
          periodEnd: current.period_end ?? null,
        };
      }
    }
  }

  // Add peak data + history to each platform
  const effectiveRange = range === 'hourly' ? 'daily' : range;
  for (const p of Object.keys(platforms)) {
    platforms[p].peaks = getPeaks(null, p, effectiveRange);

    // Platform-level history for charts
    const hLen = range === 'hourly' ? 24 : 7;
    if (tagFilter) {
      // Tag-filtered: sum history from filtered items for this platform
      const platformItems = items.filter(i => i.platform === p);
      const reachH = new Array(hLen).fill(0), interestH = new Array(hLen).fill(0), engagementH = new Array(hLen).fill(0), perfH = new Array(hLen).fill(0);
      for (const item of platformItems) {
        for (let i = 0; i < hLen; i++) {
          reachH[i] += item.reachHistory?.[i] ?? 0;
          interestH[i] += item.interestHistory?.[i] ?? 0;
          engagementH[i] += item.engagementHistory?.[i] ?? 0;
          perfH[i] += item.performanceHistory?.[i] ?? 0;
        }
      }
      platforms[p].reachHistory = reachH;
      platforms[p].interestHistory = interestH;
      platforms[p].engagementHistory = engagementH;
      platforms[p].performanceHistory = perfH;
    } else if (range === 'hourly') {
      // Hourly: use unified_hourly_metrics history
      const history = getUnifiedHourlyHistory(p, 24).reverse();
      platforms[p].reachHistory = history.map(r => r.reach_value ?? 0);
      platforms[p].interestHistory = history.map(r => r.interest_value ?? 0);
      platforms[p].engagementHistory = history.map(r => r.engagement_value ?? 0);
      platforms[p].performanceHistory = history.map(r => r.performance_score ?? 0);
      while (platforms[p].reachHistory.length < 24) platforms[p].reachHistory.unshift(0);
      while (platforms[p].interestHistory.length < 24) platforms[p].interestHistory.unshift(0);
      while (platforms[p].engagementHistory.length < 24) platforms[p].engagementHistory.unshift(0);
      while (platforms[p].performanceHistory.length < 24) platforms[p].performanceHistory.unshift(0);
    } else {
      // Unfiltered daily/weekly/monthly: use unified_metrics history
      const history = getUnifiedHistory(p, effectiveRange, 7).reverse();
      platforms[p].reachHistory = history.map(r => r.reach_value ?? 0);
      platforms[p].interestHistory = history.map(r => r.interest_value ?? 0);
      platforms[p].engagementHistory = history.map(r => r.engagement_value ?? 0);
      platforms[p].performanceHistory = history.map(r => r.performance_score ?? 0);
      // Pad to 7
      while (platforms[p].reachHistory.length < 7) platforms[p].reachHistory.unshift(0);
      while (platforms[p].interestHistory.length < 7) platforms[p].interestHistory.unshift(0);
      while (platforms[p].engagementHistory.length < 7) platforms[p].engagementHistory.unshift(0);
      while (platforms[p].performanceHistory.length < 7) platforms[p].performanceHistory.unshift(0);
    }
  }

  // Totals across all platforms (for lane cards)
  const totals = {
    reach: Object.values(platforms).reduce((s: number, p: any) => s + (p?.reach ?? 0), 0),
    interest: Object.values(platforms).reduce((s: number, p: any) => s + (p?.interest ?? 0), 0),
    engagement: Object.values(platforms).reduce((s: number, p: any) => s + (p?.engagement ?? 0), 0),
    performanceScore: Object.values(platforms).reduce((s: number, p: any) => s + (p?.performanceScore ?? 0), 0),
    velocity: {
      reach: Object.values(platforms).reduce((s: number, p: any) => s + (p?.velocity?.reach ?? 0), 0),
      interest: Object.values(platforms).reduce((s: number, p: any) => s + (p?.velocity?.interest ?? 0), 0),
      engagement: Object.values(platforms).reduce((s: number, p: any) => s + (p?.velocity?.engagement ?? 0), 0),
    },
    performanceVelocity: Object.values(platforms).reduce((s: number, p: any) => s + (p?.performanceVelocity ?? 0), 0),
    peaks: {
      reach_peak: Object.values(platforms).reduce((s: number, p: any) => s + (p?.peaks?.reach_peak ?? 0), 0),
      interest_peak: Object.values(platforms).reduce((s: number, p: any) => s + (p?.peaks?.interest_peak ?? 0), 0),
      engagement_peak: Object.values(platforms).reduce((s: number, p: any) => s + (p?.peaks?.engagement_peak ?? 0), 0),
    },
  };

  // Distribution % per lane (platform's share of total)
  const distribution: Record<string, { reach: number; interest: number; engagement: number }> = {};
  for (const [p, data] of Object.entries(platforms)) {
    if (!data) continue;
    distribution[p] = {
      reach: totals.reach > 0 ? Math.round((data.reach / totals.reach) * 10000) / 100 : 0,
      interest: totals.interest > 0 ? Math.round((data.interest / totals.interest) * 10000) / 100 : 0,
      engagement: totals.engagement > 0 ? Math.round((data.engagement / totals.engagement) * 10000) / 100 : 0,
    };
  }

  res.json({ items, platforms, totals, distribution, weights });
}));

// POST /api/dashboard/recalculate — rebuild all tracked_metrics, unified_metrics, peaks from daily platform tables
router.post('/recalculate', asyncHandler((_req: Request, res: Response) => {
  const db = require('../db/connection').default;
  const { writeMetrics } = require('../lanes/unify');
  const { setPreviousBaseline } = require('../lanes/calc');
  const { runWeeklyRollup } = require('../rollup/weekly');
  const { getWeekStart, getWeekEnd } = require('../utils/week');
  const { getLocalDate } = require('../utils/timezone');

  console.log('[Recalculate] Starting full metrics recalculation...');

  // 1. Clear all computed metrics (keep raw daily platform tables intact)
  db.prepare("DELETE FROM tracked_metrics").run();
  db.prepare("DELETE FROM unified_metrics").run();
  db.prepare("DELETE FROM peak_metrics").run();
  db.prepare("DELETE FROM tracked_hourly_metrics").run();
  db.prepare("DELETE FROM unified_hourly_metrics").run();
  db.prepare("DELETE FROM metric_previous WHERE tracked_item_id IS NOT NULL").run();

  // 2. Get all tracked items with their accounts
  const items = db.prepare(`
    SELECT ti.id, ti.metric_account_id, ma.platform
    FROM tracked_items ti
    JOIN metric_accounts ma ON ti.metric_account_id = ma.id
  `).all() as Array<{ id: number; metric_account_id: number; platform: string }>;

  const DAILY_TABLES: Record<string, string> = {
    github: 'github_daily', ga4: 'ga4_daily', bing: 'bing_daily',
  };

  let totalRows = 0;

  // 3. For each item, walk through daily rows chronologically and recalculate
  for (const item of items) {
    const dailyTable = DAILY_TABLES[item.platform];
    if (!dailyTable) continue;

    const dailyRows = db.prepare(
      `SELECT * FROM ${dailyTable} WHERE tracked_item_id = ? ORDER BY period_start ASC`
    ).all(item.id) as Record<string, any>[];

    for (const row of dailyRows) {
      writeMetrics(item.id, item.platform, 'daily', row.period_start, row.period_start, row, item.metric_account_id);
      totalRows++;
    }
  }

  // 4. Rebuild weekly rollups from corrected dailies
  const range = db.prepare(
    "SELECT MIN(period_start) as min_date, MAX(period_start) as max_date FROM tracked_metrics WHERE period_type = 'daily'"
  ).get() as { min_date: string | null; max_date: string | null };

  let weekCount = 0;
  if (range?.min_date && range?.max_date) {
    // Clear platform weekly tables
    for (const table of ['github_weekly', 'ga4_weekly', 'bing_weekly']) {
      try { db.prepare(`DELETE FROM ${table}`).run(); } catch { /* may not exist */ }
    }

    let current = getWeekStart(range.min_date);
    while (current <= range.max_date) {
      runWeeklyRollup(current);
      weekCount++;
      const d = new Date(current + 'T12:00:00');
      d.setDate(d.getDate() + 7);
      current = getLocalDate(d);
    }
  }

  // 5. Rebuild monthly rollups
  const { runMonthlyRollup } = require('../rollup/monthly');
  let monthCount = 0;
  if (range?.min_date && range?.max_date) {
    const startMonth = range.min_date.slice(0, 7);
    const endMonth = range.max_date.slice(0, 7);
    let [y, m] = startMonth.split('-').map(Number);
    while (`${y}-${String(m).padStart(2, '0')}` <= endMonth) {
      try { runMonthlyRollup(y, m); monthCount++; } catch { /* ignore */ }
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  console.log(`[Recalculate] Complete — ${totalRows} daily rows, ${weekCount} weeks, ${monthCount} months`);
  res.json({ success: true, dailyRows: totalRows, weeks: weekCount, months: monthCount });
}));

export default router;
