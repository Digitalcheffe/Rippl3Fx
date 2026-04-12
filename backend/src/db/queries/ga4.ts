import db from '../connection';

export interface GA4SnapshotInsert {
  tracked_item_id: number;
  sessions: number | null;
  pageviews: number | null;
  users: number | null;
  engagement_rate: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
}

export function insertGA4Snapshot(data: GA4SnapshotInsert): void {
  db.prepare(`
    INSERT INTO ga4_snapshots
      (tracked_item_id, sessions, pageviews, users, engagement_rate, date_range_start, date_range_end)
    VALUES
      (@tracked_item_id, @sessions, @pageviews, @users, @engagement_rate, @date_range_start, @date_range_end)
  `).run(data);
}

export function getLatestGA4Snapshot(trackedItemId: number) {
  return db.prepare(
    'SELECT * FROM ga4_snapshots WHERE tracked_item_id = ? ORDER BY collected_at DESC LIMIT 1'
  ).get(trackedItemId);
}
