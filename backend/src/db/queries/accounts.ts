import db from '../connection';
import type { MetricAccount, TrackedItem } from '../../types';

/** Account without credentials (safe for API responses). */
export type SafeAccount = Omit<MetricAccount, 'credentials'>;

// ── Polling helpers ──

export function getDueAccounts(): MetricAccount[] {
  return db.prepare(`
    SELECT * FROM metric_accounts
    WHERE is_active = 1
      AND (next_poll_at IS NULL OR next_poll_at <= datetime('now'))
  `).all() as MetricAccount[];
}

export function getActiveTrackedItems(accountId: number): TrackedItem[] {
  return db.prepare(
    'SELECT * FROM tracked_items WHERE metric_account_id = ? AND is_active = 1'
  ).all(accountId) as TrackedItem[];
}

export function updatePollSuccess(accountId: number, intervalMin: number): void {
  db.prepare(`
    UPDATE metric_accounts
    SET last_polled_at = datetime('now'),
        next_poll_at = datetime('now', '+' || ? || ' minutes'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(intervalMin, accountId);
}

export function updatePollFailure(accountId: number): void {
  db.prepare(`
    UPDATE metric_accounts
    SET next_poll_at = datetime('now', '+5 minutes'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(accountId);
}

// ── Account CRUD ──

/** Safe columns — never return credentials */
const SAFE_COLUMNS = 'id, platform, display_name, polling_interval_min, is_active, last_polled_at, next_poll_at, created_at, updated_at';

export function getAllAccounts(): SafeAccount[] {
  return db.prepare(`SELECT ${SAFE_COLUMNS} FROM metric_accounts ORDER BY created_at DESC`).all() as SafeAccount[];
}

export function getAccountById(id: number): SafeAccount | undefined {
  return db.prepare(`SELECT ${SAFE_COLUMNS} FROM metric_accounts WHERE id = ?`).get(id) as SafeAccount | undefined;
}

export function createAccount(platform: string, displayName: string, encryptedCredentials: string, pollingIntervalMin: number): SafeAccount | undefined {
  const result = db.prepare(
    'INSERT INTO metric_accounts (platform, display_name, credentials, polling_interval_min) VALUES (?, ?, ?, ?)'
  ).run(platform, displayName, encryptedCredentials, pollingIntervalMin);
  return getAccountById(result.lastInsertRowid as number);
}

export function updateAccount(id: number, updates: { display_name?: string; polling_interval_min?: number; is_active?: number; credentials?: string }): SafeAccount | undefined {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.display_name !== undefined) { fields.push('display_name = ?'); values.push(updates.display_name); }
  if (updates.polling_interval_min !== undefined) { fields.push('polling_interval_min = ?'); values.push(updates.polling_interval_min); }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }
  if (updates.credentials !== undefined) { fields.push('credentials = ?'); values.push(updates.credentials); }

  if (fields.length === 0) return getAccountById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE metric_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getAccountById(id);
}

export function deleteAccount(id: number): boolean {
  // Delete tracked items first (and their snapshots will be orphaned but harmless)
  db.prepare('DELETE FROM tracked_items WHERE metric_account_id = ?').run(id);
  const result = db.prepare('DELETE FROM metric_accounts WHERE id = ?').run(id);
  return result.changes > 0;
}
