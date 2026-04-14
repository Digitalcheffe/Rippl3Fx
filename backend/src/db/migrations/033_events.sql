CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  event_date  TEXT NOT NULL,
  event_url   TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_tags (
  event_id INTEGER NOT NULL REFERENCES events(id),
  tag_id   INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (event_id, tag_id)
);

CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_event_tags_tag ON event_tags(tag_id);
