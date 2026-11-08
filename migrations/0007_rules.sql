-- Phase 2: automatic rules, "if this then that" (docs/spec/regras-automaticas.md, ADR-009). The
-- conditions and the actions are JSON lists of tagged objects, read by src/domain/rules.ts, so a
-- new kind of condition or action needs no migration. The first rule (lowest position) wins.
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  position INTEGER NOT NULL,        -- 0-based order on screen
  conditions_json TEXT NOT NULL,    -- [{"kind":"descriptionContains","text":"ifood"}]
  actions_json TEXT NOT NULL,       -- [{"kind":"addTags","tags":{"<layerId>":"<tagId>"}}]
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
