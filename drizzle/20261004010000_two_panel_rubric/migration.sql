-- IdeaSpark incremental migration: two-panel rubric, out of 100.
--
-- Each event day a team is now scored by two panels:
--
--   Panel Type 1 (`main`): Problem Understanding /25, Idea Feasibility /20,
--                          Decision Making /25, Coordination /20  = 90
--   Panel Type 2 (`risk`): Risk Management /10                    = 10
--
-- A day is out of 100; the final leaderboard averages the days, so it is out
-- of 100 too.
--
-- 1. Panels get a type, fixed at creation.
-- 2. A team gets at most one panel of each type per round. The assignment
--    carries a copy of the panel's type so the uniqueness can be declared on
--    it, and a composite foreign key keeps that copy honest.
-- 3. `scores` gains a panel type and a Risk Management column. A row fills
--    exactly its own type's criteria (`scores_shape`), and `score` stays the
--    generated sum of whatever the row holds.
--
-- Written when `scores` and `team_panel_assignments` were both empty, so
-- nothing is backfilled beyond defaulting existing panels to `main`.

-- ---------------------------------------------------------------------------
-- 1. panel type
-- ---------------------------------------------------------------------------

CREATE TYPE panel_type_enum AS ENUM ('main', 'risk');

ALTER TABLE panels
  ADD COLUMN type panel_type_enum NOT NULL DEFAULT 'main';

ALTER TABLE panels
  ADD CONSTRAINT panels_id_type_unique UNIQUE (id, type);

-- ---------------------------------------------------------------------------
-- 2. team_panel_assignments: one panel of each type per team per round
-- ---------------------------------------------------------------------------

ALTER TABLE team_panel_assignments
  ADD COLUMN panel_type panel_type_enum;

UPDATE team_panel_assignments tpa
   SET panel_type = p.type
  FROM panels p
 WHERE p.id = tpa.panel_id;

ALTER TABLE team_panel_assignments
  ALTER COLUMN panel_type SET NOT NULL;

ALTER TABLE team_panel_assignments
  DROP CONSTRAINT team_panel_assignments_panel_id_fkey,
  DROP CONSTRAINT team_panel_assignments_team_round_unique;

ALTER TABLE team_panel_assignments
  ADD CONSTRAINT team_panel_assignments_panel_fk
    FOREIGN KEY (panel_id, panel_type)
    REFERENCES panels (id, type) ON DELETE CASCADE,
  ADD CONSTRAINT team_panel_assignments_team_round_type_unique
    UNIQUE (team_id, round_id, panel_type);

-- ---------------------------------------------------------------------------
-- 3. scores: the two-panel rubric
-- ---------------------------------------------------------------------------

-- Old rows would have no panel type and the old maxima. The table is empty at
-- this point; the delete makes that an assumption the migration states.
DELETE FROM scores;

ALTER TABLE scores DROP COLUMN score;

ALTER TABLE scores
  DROP CONSTRAINT scores_problem_understanding_range,
  DROP CONSTRAINT scores_idea_feasibility_range,
  DROP CONSTRAINT scores_decision_making_range,
  DROP CONSTRAINT scores_coordination_range;

ALTER TABLE scores
  ALTER COLUMN problem_understanding DROP NOT NULL,
  ALTER COLUMN idea_feasibility      DROP NOT NULL,
  ALTER COLUMN decision_making       DROP NOT NULL,
  ALTER COLUMN coordination          DROP NOT NULL;

ALTER TABLE scores
  ADD COLUMN panel_type      panel_type_enum NOT NULL,
  ADD COLUMN risk_management NUMERIC(5, 2);

ALTER TABLE scores
  ADD CONSTRAINT scores_problem_understanding_range
    CHECK (problem_understanding >= 0 AND problem_understanding <= 25),
  ADD CONSTRAINT scores_idea_feasibility_range
    CHECK (idea_feasibility >= 0 AND idea_feasibility <= 20),
  ADD CONSTRAINT scores_decision_making_range
    CHECK (decision_making >= 0 AND decision_making <= 25),
  ADD CONSTRAINT scores_coordination_range
    CHECK (coordination >= 0 AND coordination <= 20),
  ADD CONSTRAINT scores_risk_management_range
    CHECK (risk_management >= 0 AND risk_management <= 10),
  ADD CONSTRAINT scores_shape CHECK (
    (panel_type = 'main'
      AND problem_understanding IS NOT NULL
      AND idea_feasibility IS NOT NULL
      AND decision_making IS NOT NULL
      AND coordination IS NOT NULL
      AND risk_management IS NULL)
    OR (panel_type = 'risk'
      AND problem_understanding IS NULL
      AND idea_feasibility IS NULL
      AND decision_making IS NULL
      AND coordination IS NULL
      AND risk_management IS NOT NULL)
  );

ALTER TABLE scores
  ADD COLUMN score NUMERIC(6, 2)
    GENERATED ALWAYS AS (
      coalesce(problem_understanding, 0)
      + coalesce(idea_feasibility, 0)
      + coalesce(decision_making, 0)
      + coalesce(coordination, 0)
      + coalesce(risk_management, 0)
    ) STORED;
