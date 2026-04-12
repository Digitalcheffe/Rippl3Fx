CREATE TABLE bing_monthly (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id  INTEGER NOT NULL REFERENCES tracked_items(id),
  impressions      INTEGER,
  clicks           INTEGER,
  ctr              REAL,
  avg_rank         REAL,
  reach_score      REAL NOT NULL DEFAULT 0,
  interest_score   REAL NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tracked_item_id, period_start)
);
