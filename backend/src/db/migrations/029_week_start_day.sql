-- Add configurable week start day to user table
-- 0 = Sunday, 1 = Monday (default), ..., 6 = Saturday
ALTER TABLE user ADD COLUMN week_start_day INTEGER NOT NULL DEFAULT 1;
