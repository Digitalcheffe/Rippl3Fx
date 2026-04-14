import { Router, Request, Response } from 'express';
import { getPollLogs } from '../db/queries/logs';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// GET /api/logs?page=1&limit=100
router.get('/', asyncHandler((req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 100));
  const { logs, total } = getPollLogs(page, limit);
  res.json({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

export default router;
