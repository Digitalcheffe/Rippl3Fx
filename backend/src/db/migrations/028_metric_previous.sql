CREATE TABLE IF NOT EXISTS metric_previous (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_account_id INTEGER NOT NULL REFERENCES metric_accounts(id),
  metric_name       TEXT NOT NULL,
  previous_value    REAL NOT NULL DEFAULT 0,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(metric_account_id, metric_name)
);
