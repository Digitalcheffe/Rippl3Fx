import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { getAllAccounts, getAccountById, createAccount, updateAccount, deleteAccount, getActiveTrackedItems, updatePollSuccess, updatePollFailure } from '../db/queries/accounts';
import { encryptCredentials, decryptCredentials } from '../crypto/credentials';
import { purgeTrackedMetricsByAccount } from '../db/queries/tracked';
import { collectGithub } from '../platforms/github';
import { collectGA4 } from '../platforms/ga4';
import { collectBing } from '../platforms/bing';
import { collectAccountStats } from '../platforms/account-stats';
import { insertPollLog } from '../db/queries/logs';
import type { GithubCredentials, GA4Credentials, BingCredentials } from '../types';

const router = Router();

const VALID_PLATFORMS = ['github', 'ga4', 'bing'];

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
  if (!account) { res.status(500).json({ error: 'Failed to create account' }); return; }
  res.status(201).json(account);

  // Fire-and-forget: backfill 14 days of account-level stats
  import('../platforms/account-stats').then(({ backfillAccountStats }) => {
    backfillAccountStats(account.id, platform, credentials).catch(err =>
      console.error(`[Account] Auto-backfill failed for new account ${account.id}: ${err.message}`)
    );
  });
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

// POST /api/accounts/:id/deactivate — soft-delete: stop polling, untrack all items
router.post('/:id/deactivate', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const account = getAccountById(id);
  if (!account) { res.status(404).json({ error: 'Account not found' }); return; }

  // Deactivate account
  updateAccount(id, { is_active: 0 });
  // Untrack all items under this account (clear tags, set inactive)
  const items = db.prepare('SELECT id FROM tracked_items WHERE metric_account_id = ?').all(id) as Array<{ id: number }>;
  for (const item of items) {
    db.prepare('UPDATE tracked_items SET is_active = 0 WHERE id = ?').run(item.id);
    db.prepare('DELETE FROM item_tags WHERE tracked_item_id = ?').run(item.id);
  }

  res.json({ success: true, message: `Account deactivated. ${items.length} items untracked. Metrics preserved.` });
});

// POST /api/accounts/:id/reactivate — re-enable account
router.post('/:id/reactivate', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const account = getAccountById(id);
  if (!account) { res.status(404).json({ error: 'Account not found' }); return; }

  updateAccount(id, { is_active: 1 });
  res.json({ success: true, message: 'Account reactivated. Re-track items individually.' });
});

// DELETE /api/accounts/:id — permanent delete: purges account + items + metrics
router.delete('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const account = getAccountById(id);
  if (!account) { res.status(404).json({ error: 'Account not found' }); return; }

  const dbConn = require('../db/connection').default;
  const itemIds = dbConn.prepare('SELECT id FROM tracked_items WHERE metric_account_id = ?').all(id) as Array<{ id: number }>;
  const idList = itemIds.map(i => i.id);

  if (idList.length > 0) {
    const placeholders = idList.map(() => '?').join(',');
    // Clean up all references to tracked items
    dbConn.prepare(`DELETE FROM tracked_metrics WHERE tracked_item_id IN (${placeholders})`).run(...idList);
    dbConn.prepare(`DELETE FROM hourly_metrics WHERE tracked_item_id IN (${placeholders})`).run(...idList);
    dbConn.prepare(`DELETE FROM peak_metrics WHERE tracked_item_id IN (${placeholders})`).run(...idList);
    dbConn.prepare(`DELETE FROM metric_previous WHERE tracked_item_id IN (${placeholders})`).run(...idList);
    dbConn.prepare(`DELETE FROM item_tags WHERE tracked_item_id IN (${placeholders})`).run(...idList);
    // Platform snapshot/daily/weekly/monthly tables
    for (const table of ['github_snapshots','github_daily','github_weekly','github_monthly',
                         'ga4_snapshots','ga4_daily','ga4_weekly','ga4_monthly',
                         'bing_snapshots','bing_daily','bing_weekly','bing_monthly',
                         'reddit_snapshots','reddit_daily','reddit_weekly','reddit_monthly']) {
      try { dbConn.prepare(`DELETE FROM ${table} WHERE tracked_item_id IN (${placeholders})`).run(...idList); } catch { /* table may not exist */ }
    }
  }

  // Clean account-level metric_previous
  dbConn.prepare('DELETE FROM metric_previous WHERE metric_account_id = ? AND tracked_item_id = 0').run(id);
  // Poll logs preserved — standalone audit trail

  // Delete tracked items then account
  dbConn.prepare('DELETE FROM tracked_items WHERE metric_account_id = ?').run(id);
  dbConn.prepare('DELETE FROM metric_accounts WHERE id = ?').run(id);

  // Clean up unified_metrics for this platform if no data remains
  const platform = account.platform;
  const remaining = dbConn.prepare("SELECT COUNT(*) as c FROM tracked_metrics WHERE platform = ?").get(platform) as any;
  if (remaining.c === 0) {
    dbConn.prepare('DELETE FROM unified_metrics WHERE platform = ?').run(platform);
    dbConn.prepare('DELETE FROM peak_metrics WHERE platform = ? AND tracked_item_id IS NULL').run(platform);
  }

  res.json({ success: true, message: `Account permanently deleted. ${idList.length} items purged.` });
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

  let credentials: any;
  try {
    credentials = decryptCredentials(fullAccount.credentials);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to decrypt credentials' });
    return;
  }

  let allSuccess = true;
  const results: Array<{ item: string; success: boolean }> = [];

  // 1. Collect account-level stats → unified_metrics
  const acctResult = await collectAccountStats(id, fullAccount.platform, credentials);
  results.push({ item: `${fullAccount.platform} account`, success: acctResult.success });
  if (!acctResult.success) allSuccess = false;
  insertPollLog({ metric_account_id: id, platform: fullAccount.platform, level: acctResult.success ? 'info' : 'error', message: acctResult.success ? `Poll Now: account-level stats collected` : `Poll Now: account-level stats failed — ${acctResult.error}` });

  // 2. Collect per-tracked-item data
  const items = getActiveTrackedItems(id);
  for (const item of items) {
    let result: { success: boolean; error?: string } = { success: false, error: 'Unknown platform' };
    try {
      switch (fullAccount.platform) {
        case 'github': result = await collectGithub(item, credentials as GithubCredentials); break;
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
