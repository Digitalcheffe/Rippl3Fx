CREATE TABLE reddit_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id INTEGER NOT NULL REFERENCES tracked_items(id),
  upvotes         INTEGER,
  upvote_ratio    REAL,
  comment_count   INTEGER,
  view_count      INTEGER,
  collected_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
