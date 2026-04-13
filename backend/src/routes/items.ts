import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { getItemsByAccount, getItemById, getAllItems, createItem, updateItem, deleteItem } from '../db/queries/items';
import { getAccountById } from '../db/queries/accounts';
import { purgeTrackedMetrics } from '../db/queries/tracked';

const router = Router();

// GET /api/items
router.get('/', (_req: Request, res: Response) => {
  res.json(getAllItems());
});

// GET /api/items/:id
router.get('/:id', (req: Request, res: Response) => {
  const item = getItemById(Number(req.params.id));
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json(item);
});

// GET /api/accounts/:accountId/items
router.get('/by-account/:accountId', (req: Request, res: Response) => {
  const accountId = Number(req.params.accountId);
  const account = getAccountById(accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json(getItemsByAccount(accountId));
});

// POST /api/items
router.post('/', (req: Request, res: Response) => {
  const { metric_account_id, platform_identifier, display_name } = req.body;

  if (!metric_account_id || typeof metric_account_id !== 'number') {
    res.status(400).json({ error: 'metric_account_id is required and must be a number' });
    return;
  }

  const account = getAccountById(metric_account_id);
  if (!account) {
    res.status(400).json({ error: 'Account not found' });
    return;
  }

  if (!platform_identifier || typeof platform_identifier !== 'string') {
    res.status(400).json({ error: 'platform_identifier is required' });
    return;
  }

  if (!display_name || typeof display_name !== 'string') {
    res.status(400).json({ error: 'display_name is required' });
    return;
  }

  const item = createItem(metric_account_id, platform_identifier, display_name);
  res.status(201).json(item);

  // Fire-and-forget: backfill 14 days of historical data
  import('../backfill/historical').then(({ runHistoricalBackfill }) => {
    runHistoricalBackfill(item.id, metric_account_id, account.platform, platform_identifier);
  }).catch(err => console.error(`[Backfill] Import failed: ${err.message}`));
});

// PUT /api/items/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = getItemById(id);
  if (!existing) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const { display_name, platform_identifier, is_active } = req.body;
  const updates: Record<string, any> = {};

  if (platform_identifier !== undefined) {
    if (typeof platform_identifier !== 'string' || !platform_identifier) {
      res.status(400).json({ error: 'platform_identifier must be a non-empty string' });
      return;
    }
    updates.platform_identifier = platform_identifier;
  }

  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || !display_name) {
      res.status(400).json({ error: 'display_name must be a non-empty string' });
      return;
    }
    updates.display_name = display_name;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active ? 1 : 0;
  }

  const item = updateItem(id, updates);
  res.json(item);
});

// POST /api/items/:id/backfill — trigger 14-day historical data pull
router.post('/:id/backfill', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = getItemById(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  const account = getAccountById(item.metric_account_id);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  // Run backfill async, respond immediately
  res.json({ success: true, message: 'Backfill started' });
  try {
    const { runHistoricalBackfill } = await import('../backfill/historical');
    await runHistoricalBackfill(item.id, item.metric_account_id, account.platform, item.platform_identifier);
  } catch (err: any) {
    console.error(`[Backfill] Manual trigger failed for item ${id}: ${err.message}`);
  }
});

// POST /api/items/:id/untrack — soft-delete: stop polling, clear tags, preserve metrics
router.post('/:id/untrack', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = getItemById(id);
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  // Set inactive
  updateItem(id, { is_active: 0 });
  // Clear tag associations
  db.prepare('DELETE FROM item_tags WHERE tracked_item_id = ?').run(id);

  res.json({ success: true, message: 'Item untracked. Metrics preserved.' });
});

// POST /api/items/:id/retrack — re-enable tracking
router.post('/:id/retrack', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = getItemById(id);
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  updateItem(id, { is_active: 1 });

  // Assign tags if provided
  const { tag_ids } = req.body;
  if (Array.isArray(tag_ids)) {
    for (const tagId of tag_ids) {
      db.prepare('INSERT OR IGNORE INTO item_tags (tracked_item_id, tag_id) VALUES (?, ?)').run(id, tagId);
    }
  }

  res.json({ success: true, message: 'Item re-tracked.' });
});

// DELETE /api/items/:id — permanent delete: purges item + all tracked_metrics
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = getItemById(id);
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  // Purge tracked_metrics first (no CASCADE)
  const purged = purgeTrackedMetrics(id);
  // Then delete the item itself (cascades item_tags)
  deleteItem(id);

  res.json({ success: true, message: `Item permanently deleted. ${purged} metric rows purged.` });
});

export default router;
