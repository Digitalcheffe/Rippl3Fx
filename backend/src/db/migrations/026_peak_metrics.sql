CREATE TABLE IF NOT EXISTS peak_metrics (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_item_id      INTEGER REFERENCES tracked_items(id),
  platform             TEXT NOT NULL CHECK(platform IN ('github','ga4','bing','all')),
  period_type          TEXT NOT NULL CHECK(period_type IN ('daily','weekly','monthly')),
  reach_peak           REAL NOT NULL DEFAULT 0,
  interest_peak        REAL NOT NULL DEFAULT 0,
  engagement_peak      REAL NOT NULL DEFAULT 0,
  reach_peak_date      TEXT,
  interest_peak_date   TEXT,
  engagement_peak_date TEXT,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tracked_item_id, platform, period_type)
);

CREATE INDEX IF NOT EXISTS idx_peak_item ON peak_metrics(tracked_item_id, period_type);
CREATE INDEX IF NOT EXISTS idx_peak_platform ON peak_metrics(platform, period_type);
