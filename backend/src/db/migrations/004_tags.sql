CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE item_tags (
  tracked_item_id INTEGER NOT NULL REFERENCES tracked_items(id),
  tag_id          INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (tracked_item_id, tag_id)
);
