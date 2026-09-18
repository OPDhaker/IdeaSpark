-- IdeaSpark incremental migration: event days replace the results_published flag.
--
-- `results_published` was a manual switch nobody could reach (no admin UI) and
-- it duplicated information the schedule already carries. The leaderboard now
-- unhides on its own once day one arrives.
--
-- DATE, not timestamptz, so these compare directly against attendance.event_date.

ALTER TABLE event_config
  ADD COLUMN IF NOT EXISTS day_one DATE NOT NULL DEFAULT '2026-10-05',
  ADD COLUMN IF NOT EXISTS day_two DATE NOT NULL DEFAULT '2026-10-06';

-- The defaults exist only to backfill the single live row; drop them so every
-- future write states the dates explicitly.
ALTER TABLE event_config ALTER COLUMN day_one DROP DEFAULT;
ALTER TABLE event_config ALTER COLUMN day_two DROP DEFAULT;

ALTER TABLE event_config DROP COLUMN IF EXISTS results_published;
ALTER TABLE evaluation_rounds DROP COLUMN IF EXISTS results_published;

ALTER TABLE event_config
  ADD CONSTRAINT event_config_day_order CHECK (day_one <= day_two);

ALTER TABLE event_config
  ADD CONSTRAINT event_config_submission_before_day_one
  CHECK (submission_deadline <= day_one);
