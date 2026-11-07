-- Phase 2: categories as tags in layers (docs/spec/categorias.md). Up to 5 layers (checked by the
-- app); each layer has any number of tags; a transaction gets at most one tag per layer.
CREATE TABLE tag_layers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,       -- 0-based order on screen
  created_at TEXT NOT NULL
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  layer_id TEXT NOT NULL REFERENCES tag_layers (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (id, layer_id)            -- target of transaction_tags' composite key
);
CREATE INDEX tags_layer ON tags (layer_id);

-- My tags on each transaction. The primary key is the "one tag per layer" rule; the composite
-- foreign key keeps layer_id equal to the tag's own layer.
CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions (id),
  layer_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  tagged_at TEXT NOT NULL,
  PRIMARY KEY (transaction_id, layer_id),
  FOREIGN KEY (tag_id, layer_id) REFERENCES tags (id, layer_id) ON DELETE CASCADE
);
CREATE INDEX transaction_tags_tag ON transaction_tags (tag_id);
