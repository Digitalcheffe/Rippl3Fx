import { Router, Request, Response } from 'express';
import db from '../db/connection';
import {
  getTrackedItemsWithPlatform,
  getLatestSnapshot,
  getLatestForRange,
  getRangePair,
  getInterestHistory,
  getLaneHistory,
  getTagsForItem,
  getPreviousDailyPair,
  type DashboardItem,
} from '../db/queries/metrics';
import { getPerformanceWeights } from './performance';

const router = Router();

const LANE_METRICS: Record<string, { reach: string[]; interest: string[]; engagement: string[] }> = {
  github: {
    reach: ['traffic_views', 'traffic_uniques'],
    interest: ['stars', 'forks'],
    engagement: ['clones', 'clones_uniques'],
  },
  reddit: {
    reach: ['view_count'],
    interest: ['upvotes'],
    engagement: ['comment_count'],
  },
  ga4: {
    reach: ['pageviews'],
    interest: ['users'],
    engagement: ['sessions'],
  },
  bing: {
    reach: ['impressions'],
    interest: ['clicks'],
    engagement: [],
  },
};

function computeVelocity(
  platform: string,
  today: Record<string, any> | null,
  yesterday: Record<string, any> | null
): { reach: number; interest: number; engagement: number } {
  if (!today || !yesterday) return { reach: 0, interest: 0, engagement: 0 };
  const lm = LANE_METRICS[platform];
  if (!lm) return { reach: 0, interest: 0, engagement: 0 };

  const sum = (row: Record<string, any>, keys: string[]) =>
    keys.reduce((s, k) => s + (row[k] ?? 0), 0);

  return {
    reach: sum(today, lm.reach) - sum(yesterday, lm.reach),
    interest: sum(today, lm.interest) - sum(yesterday, lm.interest),
    engagement: sum(today, lm.engagement) - sum(yesterday, lm.engagement),
  };
}

// GET /api/dashboard?tag=NORA&range=daily
router.get('/dashboard', (req: Request, res: Response) => {
  const tagFilter = req.query.tag as string | undefined;
  const range = (req.query.range as string) || 'daily';
  const trackedItems = getTrackedItemsWithPlatform(tagFilter);

  const weights = getPerformanceWeights();

  const items: DashboardItem[] = trackedItems.map(ti => {
    // Use range-aware data: hourly uses snapshots, daily/weekly/monthly use rollup tables
    const latestSnapshot = range === 'hourly'
      ? getLatestSnapshot(ti.id, ti.platform)
      : getLatestForRange(ti.id, ti.platform, range);
    const interestHistory = getInterestHistory(ti.id, ti.platform, 7, range);
    const currentInterestScore = interestHistory[interestHistory.length - 1] ?? 0;

    // Trend: compare last 2 periods
    const today = interestHistory[interestHistory.length - 1] ?? 0;
    const yesterday = interestHistory[interestHistory.length - 2] ?? 0;
    let interestTrend: 'up' | 'down' | 'flat' = 'flat';
    if (today > yesterday) interestTrend = 'up';
    else if (today < yesterday) interestTrend = 'down';

    // Compute per-lane velocity from the selected range
    const { today: rangeToday, yesterday: rangeYesterday } = getRangePair(ti.id, ti.platform, range === 'hourly' ? 'daily' : range);
    const velocity = computeVelocity(ti.platform, rangeToday, rangeYesterday);

    // Compute performance score using weights + normalized lane scores
    let performanceScore = 0;
    let prevPerformanceScore = 0;

    const dailyTable = `${ti.platform}_daily`;
    const peakReach = (db.prepare(`SELECT MAX(reach_score) as peak FROM ${dailyTable} WHERE tracked_item_id = ?`).get(ti.id) as any)?.peak || 1;
    const peakEngagement = (db.prepare(`SELECT MAX(engagement_score) as peak FROM ${dailyTable} WHERE tracked_item_id = ?`).get(ti.id) as any)?.peak || 1;

    const normScore = (row: Record<string, any> | null) => {
      if (!row) return 0;
      const r = Math.min(100, ((row.reach_score ?? 0) / peakReach) * 100);
      const i = row.interest_score ?? 0; // already 0-100
      const e = Math.min(100, ((row.engagement_score ?? 0) / peakEngagement) * 100);
      return r * weights.reach + i * weights.interest + e * weights.engagement;
    };

    performanceScore = normScore(rangeToday);
    prevPerformanceScore = normScore(rangeYesterday);

    const reachHistory = getLaneHistory(ti.id, ti.platform, 'reach', 7, range);
    const engagementHistory = getLaneHistory(ti.id, ti.platform, 'engagement', 7, range);

    return {
      id: ti.id,
      platform: ti.platform,
      display_name: ti.display_name,
      platform_identifier: ti.platform_identifier,
      tags: getTagsForItem(ti.id),
      latestSnapshot,
      reachHistory,
      interestHistory,
      engagementHistory,
      currentInterestScore,
      interestTrend,
      velocity,
      performanceScore: Math.round(performanceScore * 100) / 100,
      performanceVelocity: Math.round((performanceScore - prevPerformanceScore) * 100) / 100,
    };
  });

  res.json({ items, weights });
});

export default router;
