-- Phase 2: a rule joins its conditions with "e" (all must hold) or "ou" (any one is enough), never
-- both (docs/spec/regras-automaticas.md). Every rule saved before this keeps "e".
ALTER TABLE rules ADD COLUMN condition_match TEXT NOT NULL DEFAULT 'all' CHECK (condition_match IN ('all', 'any'));
