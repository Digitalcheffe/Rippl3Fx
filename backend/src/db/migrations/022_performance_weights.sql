CREATE TABLE IF NOT EXISTS performance_weights (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  reach_weight      REAL NOT NULL DEFAULT 0.20,
  interest_weight   REAL NOT NULL DEFAULT 0.30,
  engagement_weight REAL NOT NULL DEFAULT 0.50,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Single row only — insert defaults
INSERT INTO performance_weights (reach_weight, interest_weight, engagement_weight) VALUES (0.20, 0.30, 0.50);
