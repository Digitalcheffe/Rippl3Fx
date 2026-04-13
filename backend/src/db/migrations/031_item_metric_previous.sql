-- Recreate metric_previous with tracked_item_id support.
-- SQLite can't ALTER constraints, so we recreate the table.
-- Use tracked_item_id = 0 for account-level (instead of NULL) to make UNIQUE work.

CREATE TABLE metric_previous_backup AS SELECT * FROM metric_previous;
DROP TABLE metric_previous;

CREATE TABLE metric_previous (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_account_id INTEGER NOT NULL REFERENCES metric_accounts(id),
  tracked_item_id   INTEGER NOT NULL DEFAULT 0,
  metric_name       TEXT NOT NULL,
  previous_value    REAL NOT NULL DEFAULT 0,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(metric_account_id, tracked_item_id, metric_name)
);

-- Restore account-level data (tracked_item_id = 0)
INSERT INTO metric_previous (metric_account_id, tracked_item_id, metric_name, previous_value, updated_at)
  SELECT metric_account_id, 0, metric_name, previous_value, updated_at FROM metric_previous_backup;

DROP TABLE metric_previous_backup;
