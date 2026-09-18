-- Reconcile branches that were created from the earlier event schema.
ALTER TABLE event_config
  ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE evaluation_rounds
  ADD COLUMN IF NOT EXISTS results_published BOOLEAN NOT NULL DEFAULT FALSE;