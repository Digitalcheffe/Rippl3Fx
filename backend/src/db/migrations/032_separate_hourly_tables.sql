-- Rename hourly_metrics → tracked_hourly_metrics (per-item throwaway data)
ALTER TABLE hourly_metrics RENAME TO tracked_hourly_metrics;

-- Create unified_hourly_metrics (account/platform-level throwaway data)
CREATE TABLE IF NOT EXISTS unified_hourly_metrics (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  platform          TEXT NOT NULL CHECK(platform IN ('reddit','github','ga4','bing')),
  period_start      TEXT NOT NULL,
  reach_value       REAL NOT NULL DEFAULT 0,
  interest_value    REAL NOT NULL DEFAULT 0,
  engagement_value  REAL NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, period_start)
);

CREATE INDEX IF NOT EXISTS idx_unified_hourly_platform ON unified_hourly_metrics(platform, period_start);
CREATE INDEX IF NOT EXISTS idx_unified_hourly_created ON unified_hourly_metrics(created_at);
