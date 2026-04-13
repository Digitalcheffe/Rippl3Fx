-- Separate hourly metrics table — throwaway real-time data, purged after 48hrs.
-- Previously hourly rows lived in tracked_metrics with period_type='hourly'.
CREATE TABLE IF NOT EXISTS hourly_metrics (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id   INTEGER NOT NULL REFERENCES tracked_items(id),
  platform          TEXT NOT NULL CHECK(platform IN ('reddit','github','ga4','bing')),
  period_start      TEXT NOT NULL,
  reach_value       REAL NOT NULL DEFAULT 0,
  interest_value    REAL NOT NULL DEFAULT 0,
  engagement_value  REAL NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tracked_item_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_hourly_item ON hourly_metrics(tracked_item_id, period_start);
CREATE INDEX IF NOT EXISTS idx_hourly_created ON hourly_metrics(created_at);

-- Migrate existing hourly rows from tracked_metrics
INSERT OR IGNORE INTO hourly_metrics (tracked_item_id, platform, period_start, reach_value, interest_value, engagement_value, performance_score, created_at)
  SELECT tracked_item_id, platform, period_start, reach_value, interest_value, engagement_value, performance_score, created_at
  FROM tracked_metrics WHERE period_type = 'hourly';

-- Remove hourly rows from tracked_metrics (permanent pipeline only)
DELETE FROM tracked_metrics WHERE period_type = 'hourly';
