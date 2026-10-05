-- IdeaSpark incremental migration: per-round team progress for volunteers.
--
-- Volunteers at /admin/team-panels mark each team To be done / Ongoing / Done
-- for the round they are running. It gates nothing and is not scored.
--
-- No row means "To be done", so a round starts clean without seeding. It is
-- its own table rather than a column on team_panel_assignments, so moving a
-- team to another panel never resets its progress.
--
-- Additive only: a new enum and a new table.

CREATE TYPE team_progress_enum AS ENUM ('todo', 'ongoing', 'done');

CREATE TABLE team_round_progress (
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  round_id   UUID NOT NULL REFERENCES evaluation_rounds(id) ON DELETE CASCADE,
  status     team_progress_enum NOT NULL,
  updated_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_round_progress_team_id_round_id_pk PRIMARY KEY (team_id, round_id)
);
