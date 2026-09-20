-- IdeaSpark incremental migration: the team leaderboard is published, not scheduled.
--
-- This re-adds a switch that 20260918010000_event_days deliberately removed.
-- That migration dropped `event_config.results_published` because it was "a
-- manual switch nobody could reach (no admin UI) and it duplicated information
-- the schedule already carries". Both halves are reversed here on purpose:
--
--   * The UI now exists — /admin/event, super_admin only.
--   * The schedule turns out NOT to carry the information. `day_one` says when
--     judging starts, and scores land in `scores` one judge at a time as the
--     day runs. Unlocking on a date therefore shows teams a half-judged board.
--     When judging is *finished* is a call someone makes in the room.
--
-- Named `leaderboard_published`, not `results_published`: it gates exactly one
-- route, and the old name's vagueness is part of why nothing ever drove it.
--
-- Default false — the board starts hidden and has to be published on purpose.
-- The live row flips to hidden on migrate, which is the intended state anyway.

ALTER TABLE event_config
  ADD COLUMN IF NOT EXISTS leaderboard_published BOOLEAN NOT NULL DEFAULT false;
