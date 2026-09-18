-- IdeaSpark repair migration: finish 20260918010000_unify_review_status and
-- 20260918020000_event_days, both of which reached the database only partially.
--
-- What had landed: submissions.status was already retyped to review_status_enum (the ALTER TYPE
-- RENAME ran), and event_config gained day_one/day_two. What had not: teams.status was still
-- team_status_enum, so every insert of 'pending_submission' failed with an invalid enum value, and
-- results_published survived on event_config and evaluation_rounds.
--
-- Written idempotently: re-running it is a no-op, and on a database built from the full migration
-- chain the teams block is skipped because the column is already review_status_enum.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams'
      AND column_name = 'status' AND udt_name = 'team_status_enum'
  ) THEN
    ALTER TABLE teams ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE teams
      ALTER COLUMN status TYPE review_status_enum
      USING (
        CASE status::text
          WHEN 'pending'  THEN 'pending_submission'
          WHEN 'approved' THEN 'accepted'
          ELSE 'rejected'
        END
      )::review_status_enum;

    ALTER TABLE teams ALTER COLUMN status SET DEFAULT 'pending_submission';
  END IF;
END $$;

DROP TYPE IF EXISTS team_status_enum;

-- The event days replaced this flag; nothing in src/ or scripts/ reads it.
ALTER TABLE event_config DROP COLUMN IF EXISTS results_published;
ALTER TABLE evaluation_rounds DROP COLUMN IF EXISTS results_published;
