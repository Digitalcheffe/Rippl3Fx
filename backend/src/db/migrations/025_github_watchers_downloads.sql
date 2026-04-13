ALTER TABLE github_snapshots ADD COLUMN watchers INTEGER DEFAULT 0;
ALTER TABLE github_snapshots ADD COLUMN release_downloads INTEGER DEFAULT 0;

ALTER TABLE github_daily ADD COLUMN watchers INTEGER DEFAULT 0;
ALTER TABLE github_daily ADD COLUMN release_downloads INTEGER DEFAULT 0;

ALTER TABLE github_weekly ADD COLUMN watchers INTEGER DEFAULT 0;
ALTER TABLE github_weekly ADD COLUMN release_downloads INTEGER DEFAULT 0;

ALTER TABLE github_monthly ADD COLUMN watchers INTEGER DEFAULT 0;
ALTER TABLE github_monthly ADD COLUMN release_downloads INTEGER DEFAULT 0;
