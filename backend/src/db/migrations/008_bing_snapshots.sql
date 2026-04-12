CREATE TABLE bing_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id  INTEGER NOT NULL REFERENCES tracked_items(id),
  impressions      INTEGER,
  clicks           INTEGER,
  ctr              REAL,
  avg_rank         REAL,
  date_range_start TEXT,
  date_range_end   TEXT,
  collected_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
