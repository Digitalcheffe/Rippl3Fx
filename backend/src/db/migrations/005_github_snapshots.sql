CREATE TABLE github_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id INTEGER NOT NULL REFERENCES tracked_items(id),
  stars           INTEGER,
  forks           INTEGER,
  open_issues     INTEGER,
  traffic_views   INTEGER,
  traffic_uniques INTEGER,
  clones          INTEGER,
  clones_uniques  INTEGER,
  collected_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
