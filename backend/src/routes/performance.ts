import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { asyncHandler } from '../middleware/asyncHandler';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();
router.use(apiLimiter);

interface PerformanceWeights {
  id: number;
  reach_weight: number;
  interest_weight: number;
  engagement_weight: number;
  updated_at: string;
}

// GET /api/performance/weights
router.get('/weights', asyncHandler((_req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM performance_weights LIMIT 1').get() as PerformanceWeights | undefined;
  if (!row) {
    res.json({ reach_weight: 0.20, interest_weight: 0.30, engagement_weight: 0.50 });
    return;
  }
  res.json({
    reach_weight: row.reach_weight,
    interest_weight: row.interest_weight,
    engagement_weight: row.engagement_weight,
  });
}));

// PUT /api/performance/weights
router.put('/weights', asyncHandler((req: Request, res: Response) => {
  const { reach_weight, interest_weight, engagement_weight } = req.body;

  if (typeof reach_weight !== 'number' || typeof interest_weight !== 'number' || typeof engagement_weight !== 'number') {
    res.status(400).json({ error: 'All three weights must be numbers' });
    return;
  }

  const sum = Math.round((reach_weight + interest_weight + engagement_weight) * 100);
  if (sum !== 100) {
    res.status(400).json({ error: `Weights must sum to 1.0 (got ${(reach_weight + interest_weight + engagement_weight).toFixed(2)})` });
    return;
  }

  const existing = db.prepare('SELECT id FROM performance_weights LIMIT 1').get() as { id: number } | undefined;
  if (existing) {
    db.prepare(
      'UPDATE performance_weights SET reach_weight = ?, interest_weight = ?, engagement_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(reach_weight, interest_weight, engagement_weight, existing.id);
  } else {
    db.prepare(
      'INSERT INTO performance_weights (reach_weight, interest_weight, engagement_weight) VALUES (?, ?, ?)'
    ).run(reach_weight, interest_weight, engagement_weight);
  }

  res.json({ reach_weight, interest_weight, engagement_weight });
}));

export function getPerformanceWeights(): { reach: number; interest: number; engagement: number } {
  const row = db.prepare('SELECT reach_weight, interest_weight, engagement_weight FROM performance_weights LIMIT 1').get() as any;
  if (!row) return { reach: 0.20, interest: 0.30, engagement: 0.50 };
  return { reach: row.reach_weight, interest: row.interest_weight, engagement: row.engagement_weight };
}

export default router;
