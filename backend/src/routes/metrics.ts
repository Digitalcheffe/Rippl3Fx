import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { getTrackedItemsWithPlatform, getTagsForItem, getLatestSnapshot } from '../db/queries/metrics';
import { getLatestTracked, getTrackedPair, getTrackedHistory } from '../db/queries/tracked';
import { getUnifiedPair, getAllPlatformHistory } from '../db/queries/unified';
import { getPerformanceWeights } from './performance';

const router = Router();

// GET /api/dashboard?tag=NORA&range=daily
router.get('/dashboard', (req: Request, res: Response) => {
  const tagFilter = req.query.tag as string | undefined;
  const range = (req.query.range as string) || 'daily';
  const trackedItems = getTrackedItemsWithPlatform(tagFilter);
  const weights = getPerformanceWeights();

  const items = trackedItems.map(ti => {
    // Get current + previous from tracked_metrics for this range
    const { current, previous } = getTrackedPair(ti.id, range);

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

    // History arrays for charts (last 7 periods)
    const history = getTrackedHistory(ti.id, range, 7).reverse();
    const reachHistory = history.map(r => r.reach_value ?? 0);
    const interestHistory = history.map(r => r.interest_value ?? 0);
    const engagementHistory = history.map(r => r.engagement_value ?? 0);
    const performanceHistory = history.map(r => r.performance_score ?? 0);

    // Pad to 7 if less
    while (reachHistory.length < 7) reachHistory.unshift(0);
    while (interestHistory.length < 7) interestHistory.unshift(0);
    while (engagementHistory.length < 7) engagementHistory.unshift(0);
    while (performanceHistory.length < 7) performanceHistory.unshift(0);

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
      // History for charts
      reachHistory,
      interestHistory,
      engagementHistory,
      performanceHistory,
    };
  });

  // Platform-level data from unified_metrics
  const platforms: Record<string, any> = {};
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
      };
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
});

export default router;
