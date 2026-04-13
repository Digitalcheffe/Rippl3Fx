CREATE TABLE IF NOT EXISTS tracked_metrics (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id   INTEGER NOT NULL REFERENCES tracked_items(id),
  platform          TEXT NOT NULL CHECK(platform IN ('reddit','github','ga4','bing')),
  period_type       TEXT NOT NULL CHECK(period_type IN ('hourly','daily','weekly','monthly')),
  period_start      TEXT NOT NULL,
  period_end        TEXT NOT NULL,
  reach_value       REAL NOT NULL DEFAULT 0,
  interest_value    REAL NOT NULL DEFAULT 0,
  engagement_value  REAL NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tracked_item_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_tracked_item_period ON tracked_metrics(tracked_item_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_tracked_platform_period ON tracked_metrics(platform, period_type, period_start);
