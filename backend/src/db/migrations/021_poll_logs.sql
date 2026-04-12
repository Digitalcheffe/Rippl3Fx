CREATE TABLE poll_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_account_id INTEGER NOT NULL,
  tracked_item_id INTEGER,
  platform        TEXT NOT NULL,
  level           TEXT NOT NULL CHECK(level IN ('info','warn','error')),
  message         TEXT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
