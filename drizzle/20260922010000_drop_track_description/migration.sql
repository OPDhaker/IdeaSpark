-- IdeaSpark incremental migration: a track is its name, nothing more.
--
-- `tracks.description` held a one-line blurb per track. It was seeded from
-- `src/db/seed-tracks.ts` and, until /tracks was built, rendered nowhere: the
-- registration step picks a track by name from a <select>, and the dashboard
-- card shows the name. `/tracks` now renders name-only cards, so the column has
-- no reader left.
--
-- Dropping rather than leaving it nullable-and-unused: a column nothing writes
-- and nothing reads is a column that drifts. The copy itself is not lost — it
-- stays in this repo's history, in the pre-drop version of seed-tracks.ts.

ALTER TABLE tracks
  DROP COLUMN IF EXISTS description;
