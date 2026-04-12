CREATE TABLE metric_accounts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  platform             TEXT NOT NULL CHECK(platform IN ('reddit','github','ga4','bing')),
  display_name         TEXT NOT NULL,
  credentials          TEXT NOT NULL,
  polling_interval_min INTEGER NOT NULL DEFAULT 60,
  is_active            BOOLEAN NOT NULL DEFAULT 1,
  last_polled_at       DATETIME,
  next_poll_at         DATETIME,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
