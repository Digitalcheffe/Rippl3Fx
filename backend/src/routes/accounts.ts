import { Router, Request, Response } from 'express';
import { getAllAccounts, getAccountById, createAccount, updateAccount, deleteAccount, getActiveTrackedItems, updatePollSuccess, updatePollFailure } from '../db/queries/accounts';
import { encryptCredentials, decryptCredentials } from '../crypto/credentials';
import { collectGithub } from '../platforms/github';
import { collectReddit } from '../platforms/reddit';
import { collectGA4 } from '../platforms/ga4';
import { collectBing } from '../platforms/bing';
import { insertPollLog } from '../db/queries/logs';
import type { GithubCredentials, RedditCredentials, GA4Credentials, BingCredentials } from '../types';

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

// POST /api/accounts/:id/poll-now — trigger immediate poll
router.post('/:id/poll-now', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const account = getAccountById(id);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  // Need the full account with credentials for polling
  const db = require('../db/connection').default;
  const fullAccount = db.prepare('SELECT * FROM metric_accounts WHERE id = ?').get(id) as any;

  const items = getActiveTrackedItems(id);
  if (items.length === 0) {
    res.status(400).json({ error: 'No active tracked items for this account' });
    return;
  }

  let credentials: any;
  try {
    credentials = decryptCredentials(fullAccount.credentials);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to decrypt credentials' });
    return;
  }

  let allSuccess = true;
  const results: Array<{ item: string; success: boolean }> = [];

  for (const item of items) {
    let result: { success: boolean; error?: string } = { success: false, error: 'Unknown platform' };
    try {
      switch (fullAccount.platform) {
        case 'github': result = await collectGithub(item, credentials as GithubCredentials); break;
        case 'reddit': result = await collectReddit(item, credentials as RedditCredentials); break;
        case 'ga4': result = await collectGA4(item, credentials as GA4Credentials); break;
        case 'bing': result = await collectBing(item, credentials as BingCredentials); break;
      }
    } catch (err: any) {
      result = { success: false, error: err.message };
    }
    if (result.success) {
      insertPollLog({ metric_account_id: id, tracked_item_id: item.id, platform: fullAccount.platform, level: 'info', message: `Poll Now: collected ${item.display_name} (${item.platform_identifier})` });
    } else {
      insertPollLog({ metric_account_id: id, tracked_item_id: item.id, platform: fullAccount.platform, level: 'error', message: `Poll Now: failed ${item.display_name} (${item.platform_identifier}) — ${result.error}` });
    }
    results.push({ item: item.display_name, success: result.success });
    if (!result.success) allSuccess = false;
  }

  if (allSuccess) {
    updatePollSuccess(id, fullAccount.polling_interval_min);
  } else {
    updatePollFailure(id);
  }

  res.json({ success: allSuccess, results });
});

export default router;
