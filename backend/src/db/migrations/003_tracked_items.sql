CREATE TABLE tracked_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_account_id   INTEGER NOT NULL REFERENCES metric_accounts(id),
  platform_identifier TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
