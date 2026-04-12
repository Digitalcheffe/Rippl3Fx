import db from '../connection';

export interface BingSnapshotInsert {
  tracked_item_id: number;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  avg_rank: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
}

export function insertBingSnapshot(data: BingSnapshotInsert): void {
  db.prepare(`
    INSERT INTO bing_snapshots
      (tracked_item_id, impressions, clicks, ctr, avg_rank, date_range_start, date_range_end)
    VALUES
      (@tracked_item_id, @impressions, @clicks, @ctr, @avg_rank, @date_range_start, @date_range_end)
  `).run(data);
}

export function getLatestBingSnapshot(trackedItemId: number) {
  return db.prepare(
    'SELECT * FROM bing_snapshots WHERE tracked_item_id = ? ORDER BY collected_at DESC LIMIT 1'
  ).get(trackedItemId);
}
