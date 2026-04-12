import db from '../connection';
import type { MetricAccount, TrackedItem } from '../../types';

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
