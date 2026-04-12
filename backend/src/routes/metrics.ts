import { Router, Request, Response } from 'express';
import {
  getTrackedItemsWithPlatform,
  getLatestSnapshot,
  getInterestHistory,
  getTagsForItem,
  type DashboardItem,
} from '../db/queries/metrics';

const router = Router();

// GET /api/dashboard?tag=NORA&range=daily
router.get('/dashboard', (req: Request, res: Response) => {
  const tagFilter = req.query.tag as string | undefined;
  const range = (req.query.range as string) || 'daily';
  const trackedItems = getTrackedItemsWithPlatform(tagFilter);

  const items: DashboardItem[] = trackedItems.map(ti => {
    const latestSnapshot = getLatestSnapshot(ti.id, ti.platform);
    const interestHistory = getInterestHistory(ti.id, ti.platform, 7, range);
    const currentInterestScore = interestHistory[interestHistory.length - 1] ?? 0;

    // Trend: compare last 2 days
    const today = interestHistory[interestHistory.length - 1] ?? 0;
    const yesterday = interestHistory[interestHistory.length - 2] ?? 0;
    let interestTrend: 'up' | 'down' | 'flat' = 'flat';
    if (today > yesterday) interestTrend = 'up';
    else if (today < yesterday) interestTrend = 'down';

    return {
      id: ti.id,
      platform: ti.platform,
      display_name: ti.display_name,
      platform_identifier: ti.platform_identifier,
      tags: getTagsForItem(ti.id),
      latestSnapshot,
      interestHistory,
      currentInterestScore,
      interestTrend,
    };
  });

  res.json({ items });
});

export default router;
