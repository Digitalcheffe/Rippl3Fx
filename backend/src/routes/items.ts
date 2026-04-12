import { Router, Request, Response } from 'express';
import { getItemsByAccount, getItemById, getAllItems, createItem, updateItem, deleteItem } from '../db/queries/items';
import { getAccountById } from '../db/queries/accounts';

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

// DELETE /api/items/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteItem(id);
  if (!deleted) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
