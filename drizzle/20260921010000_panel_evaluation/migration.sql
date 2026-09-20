-- IdeaSpark incremental migration: panel evaluation.
--
-- Three things happen here, and they belong in one file because the sheet is
-- unusable without all of them.
--
-- 1. `scores` swaps an unused rubric (innovation / feasibility / impact /
--    presentation, all nullable, never written) for the real one: four criteria
--    totalling 50. Each column carries its own range check, so "out of 50" is
--    structural — there is no separate total to drift from its parts. `score`
--    becomes GENERATED, which is why it is dropped and re-added: Postgres
--    cannot ALTER a plain column into a generated one.
--
-- 2. `evaluation_rounds` gains a URL slug and the event day it runs on. The day
--    decides which attendance rows make a team judgeable, so it has to be a
--    column — a CHECK cannot reach into event_config to derive it.
--
-- 3. Panels: a judge sits on one panel, a panel judges a set of teams per
--    round, and the team's score is that panel's per-criterion mean.

-- ---------------------------------------------------------------------------
-- 1. scores: the real rubric
-- ---------------------------------------------------------------------------

ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_score_range;

ALTER TABLE scores
  DROP COLUMN IF EXISTS innovation,
  DROP COLUMN IF EXISTS feasibility,
  DROP COLUMN IF EXISTS impact,
  DROP COLUMN IF EXISTS presentation,
  DROP COLUMN IF EXISTS score;

-- Every score row must now carry all four criteria, so there is nothing to
-- backfill: the table is emptied rather than filled with invented numbers.
-- Only test data exists at this point.
DELETE FROM scores;

ALTER TABLE scores
  ADD COLUMN problem_understanding NUMERIC(5, 2) NOT NULL,
  ADD COLUMN idea_feasibility      NUMERIC(5, 2) NOT NULL,
  ADD COLUMN decision_making       NUMERIC(5, 2) NOT NULL,
  ADD COLUMN coordination          NUMERIC(5, 2) NOT NULL;

ALTER TABLE scores
  ADD CONSTRAINT scores_problem_understanding_range
    CHECK (problem_understanding >= 0 AND problem_understanding <= 15),
  ADD CONSTRAINT scores_idea_feasibility_range
    CHECK (idea_feasibility >= 0 AND idea_feasibility <= 10),
  ADD CONSTRAINT scores_decision_making_range
    CHECK (decision_making >= 0 AND decision_making <= 15),
  ADD CONSTRAINT scores_coordination_range
    CHECK (coordination >= 0 AND coordination <= 10);

-- The one number every read path ranks on, kept honest by the database rather
-- than by whichever action last wrote a row.
ALTER TABLE scores
  ADD COLUMN score NUMERIC(6, 2)
    GENERATED ALWAYS AS (
      problem_understanding + idea_feasibility + decision_making + coordination
    ) STORED;

-- ---------------------------------------------------------------------------
-- 2. evaluation_rounds: slug + event day
-- ---------------------------------------------------------------------------

ALTER TABLE evaluation_rounds
  ADD COLUMN IF NOT EXISTS slug       VARCHAR(64),
  ADD COLUMN IF NOT EXISTS event_date DATE;

UPDATE evaluation_rounds
   SET slug = 'isd-' || sequence_no
 WHERE slug IS NULL;

UPDATE evaluation_rounds r
   SET event_date = CASE WHEN r.sequence_no <= 1 THEN c.day_one ELSE c.day_two END
  FROM event_config c
 WHERE c.id = 1
   AND r.event_date IS NULL;

-- On a fresh branch both tables are empty, so SET NOT NULL passes trivially and
-- `db:seed` supplies the columns. On the live branch the backfill above has
-- already filled them.
ALTER TABLE evaluation_rounds
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN event_date SET NOT NULL;

ALTER TABLE evaluation_rounds
  ADD CONSTRAINT evaluation_rounds_slug_unique UNIQUE (slug);

ALTER TABLE evaluation_rounds
  ADD CONSTRAINT evaluation_rounds_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------------------------------------------------------------------------
-- 3. Panels
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS panels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT panels_name_not_blank CHECK (length(trim(name)) > 0)
);

-- UNIQUE (admin_id) is the "one panel per judge" rule. Panels are global and
-- assignments are per round, so a judge on two panels would have an ambiguous
-- queue — there would be no single answer to "which teams are mine".
CREATE TABLE IF NOT EXISTS panel_members (
  panel_id UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  PRIMARY KEY (panel_id, admin_id),
  CONSTRAINT panel_members_one_panel_per_admin UNIQUE (admin_id)
);

CREATE INDEX IF NOT EXISTS panel_members_admin_id_idx ON panel_members (admin_id);

CREATE TABLE IF NOT EXISTS team_panel_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round_id    UUID NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  panel_id    UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_panel_assignments_team_round_unique UNIQUE (team_id, round_id)
);

CREATE INDEX IF NOT EXISTS team_panel_assignments_round_panel_idx
  ON team_panel_assignments (round_id, panel_id);

CREATE INDEX IF NOT EXISTS team_panel_assignments_team_id_idx
  ON team_panel_assignments (team_id);
