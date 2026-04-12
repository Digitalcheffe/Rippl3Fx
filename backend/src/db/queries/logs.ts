import db from '../connection';

export interface PollLog {
  id: number;
  metric_account_id: number;
  tracked_item_id: number | null;
  platform: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

export function insertPollLog(data: {
  metric_account_id: number;
  tracked_item_id?: number | null;
  platform: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}): void {
  db.prepare(`
    INSERT INTO poll_logs (metric_account_id, tracked_item_id, platform, level, message)
    VALUES (@metric_account_id, @tracked_item_id, @platform, @level, @message)
  `).run({
    ...data,
    tracked_item_id: data.tracked_item_id ?? null,
  });
}

export function getPollLogs(page: number = 1, limit: number = 100): { logs: PollLog[]; total: number } {
  const offset = (page - 1) * limit;
  const total = (db.prepare('SELECT COUNT(*) as c FROM poll_logs').get() as { c: number }).c;
  const logs = db.prepare(
    'SELECT * FROM poll_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset) as PollLog[];
  return { logs, total };
}
