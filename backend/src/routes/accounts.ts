import { Router, Request, Response } from 'express';
import { getAllAccounts, getAccountById, createAccount, updateAccount, deleteAccount } from '../db/queries/accounts';
import { encryptCredentials } from '../crypto/credentials';

const router = Router();

const VALID_PLATFORMS = ['reddit', 'github', 'ga4', 'bing'];

// GET /api/accounts
router.get('/', (_req: Request, res: Response) => {
  res.json(getAllAccounts());
});

// GET /api/accounts/:id
router.get('/:id', (req: Request, res: Response) => {
  const account = getAccountById(Number(req.params.id));
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json(account);
});

// POST /api/accounts
router.post('/', (req: Request, res: Response) => {
  const { platform, display_name, credentials, polling_interval_min } = req.body;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    res.status(400).json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` });
    return;
  }
  if (!display_name || typeof display_name !== 'string') {
    res.status(400).json({ error: 'display_name is required' });
    return;
  }
  if (!credentials || typeof credentials !== 'object') {
    res.status(400).json({ error: 'credentials object is required' });
    return;
  }

  const interval = polling_interval_min ?? 60;
  if (typeof interval !== 'number' || interval < 1) {
    res.status(400).json({ error: 'polling_interval_min must be a positive number' });
    return;
  }

  const encrypted = encryptCredentials(credentials);
  const account = createAccount(platform, display_name, encrypted, interval);
  res.status(201).json(account);
});

// PUT /api/accounts/:id
router.put('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = getAccountById(id);
  if (!existing) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const { display_name, polling_interval_min, is_active, credentials } = req.body;
  const updates: Record<string, any> = {};

  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || !display_name) {
      res.status(400).json({ error: 'display_name must be a non-empty string' });
      return;
    }
    updates.display_name = display_name;
  }

  if (polling_interval_min !== undefined) {
    if (typeof polling_interval_min !== 'number' || polling_interval_min < 1) {
      res.status(400).json({ error: 'polling_interval_min must be a positive number' });
      return;
    }
    updates.polling_interval_min = polling_interval_min;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active ? 1 : 0;
  }

  if (credentials !== undefined) {
    if (typeof credentials !== 'object') {
      res.status(400).json({ error: 'credentials must be an object' });
      return;
    }
    updates.credentials = encryptCredentials(credentials);
  }

  const account = updateAccount(id, updates);
  res.json(account);
});

// DELETE /api/accounts/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const deleted = deleteAccount(id);
  if (!deleted) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
