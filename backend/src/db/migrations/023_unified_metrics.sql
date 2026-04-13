CREATE TABLE IF NOT EXISTS unified_metrics (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  platform          TEXT NOT NULL CHECK(platform IN ('reddit','github','ga4','bing')),
  period_type       TEXT NOT NULL CHECK(period_type IN ('hourly','daily','weekly','monthly')),
  period_start      TEXT NOT NULL,
  period_end        TEXT NOT NULL,
  reach_value       REAL NOT NULL DEFAULT 0,
  interest_value    REAL NOT NULL DEFAULT 0,
  engagement_value  REAL NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_unified_platform_period ON unified_metrics(platform, period_type, period_start);
