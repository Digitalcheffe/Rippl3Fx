import db from '../connection';

export interface GithubSnapshotInsert {
  tracked_item_id: number;
  stars: number | null;
  forks: number | null;
  open_issues: number | null;
  watchers: number | null;
  traffic_views: number | null;
  traffic_uniques: number | null;
  clones: number | null;
  clones_uniques: number | null;
  release_downloads: number | null;
}

export function insertGithubSnapshot(data: GithubSnapshotInsert): void {
  db.prepare(`
    INSERT INTO github_snapshots
      (tracked_item_id, stars, forks, open_issues, watchers, traffic_views, traffic_uniques, clones, clones_uniques, release_downloads)
    VALUES
      (@tracked_item_id, @stars, @forks, @open_issues, @watchers, @traffic_views, @traffic_uniques, @clones, @clones_uniques, @release_downloads)
  `).run(data);
}

export function getLatestGithubSnapshot(trackedItemId: number) {
  return db.prepare(
    'SELECT * FROM github_snapshots WHERE tracked_item_id = ? ORDER BY collected_at DESC LIMIT 1'
  ).get(trackedItemId);
}
