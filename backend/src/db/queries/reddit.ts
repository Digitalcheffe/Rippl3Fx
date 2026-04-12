import db from '../connection';

export interface RedditSnapshotInsert {
  tracked_item_id: number;
  upvotes: number | null;
  upvote_ratio: number | null;
  comment_count: number | null;
  view_count: number | null;
}

export function insertRedditSnapshot(data: RedditSnapshotInsert): void {
  db.prepare(`
    INSERT INTO reddit_snapshots
      (tracked_item_id, upvotes, upvote_ratio, comment_count, view_count)
    VALUES
      (@tracked_item_id, @upvotes, @upvote_ratio, @comment_count, @view_count)
  `).run(data);
}

export function getLatestRedditSnapshot(trackedItemId: number) {
  return db.prepare(
    'SELECT * FROM reddit_snapshots WHERE tracked_item_id = ? ORDER BY collected_at DESC LIMIT 1'
  ).get(trackedItemId);
}
