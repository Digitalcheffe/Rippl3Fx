CREATE TABLE IF NOT EXISTS metric_config (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  platform    TEXT NOT NULL CHECK(platform IN ('github','ga4','bing')),
  metric_name TEXT NOT NULL,
  calc_type   TEXT NOT NULL CHECK(calc_type IN ('delta','incremental')),
  lane        TEXT NOT NULL CHECK(lane IN ('reach','interest','engagement')),
  UNIQUE(platform, metric_name)
);

-- GitHub: traffic/clones are incremental, stars/watchers/forks/release_downloads are delta (cumulative)
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('github', 'traffic_views', 'incremental', 'reach');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('github', 'stars', 'delta', 'interest');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('github', 'watchers', 'delta', 'interest');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('github', 'forks', 'delta', 'engagement');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('github', 'clones', 'incremental', 'engagement');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('github', 'release_downloads', 'delta', 'engagement');

-- GA4: all incremental (daily API returns per-day values)
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('ga4', 'pageviews', 'incremental', 'reach');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('ga4', 'users', 'incremental', 'interest');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('ga4', 'sessions', 'incremental', 'engagement');

-- Bing: all incremental (daily API returns per-day values)
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('bing', 'impressions', 'incremental', 'reach');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('bing', 'clicks', 'incremental', 'interest');
INSERT INTO metric_config (platform, metric_name, calc_type, lane) VALUES ('bing', 'ctr', 'incremental', 'engagement');
