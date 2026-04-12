CREATE TABLE ga4_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id  INTEGER NOT NULL REFERENCES tracked_items(id),
  sessions         INTEGER,
  pageviews        INTEGER,
  users            INTEGER,
  engagement_rate  REAL,
  date_range_start TEXT,
  date_range_end   TEXT,
  collected_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
