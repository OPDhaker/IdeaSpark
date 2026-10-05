-- IdeaSpark incremental migration: close a round's scoring.
--
-- Once a round is judged, a super admin closes it at /admin/event and no judge
-- can save or change a score in it. Separate from is_active, which also drives
-- the team dashboard and deck submissions; closing scoring must not touch
-- either.
--
-- Additive only: one column, every existing round stays open.

ALTER TABLE evaluation_rounds
  ADD COLUMN scoring_closed BOOLEAN NOT NULL DEFAULT false;
