-- IdeaSpark incremental migration:
-- 1) collapse team_status_enum + submission_status_enum into one review_status_enum
-- 2) add the admin-configurable deck template link

-- `teams.status` and `submissions.status` describe the same lifecycle, so they
-- now share one type. Old team values map: pending -> pending_submission,
-- approved -> accepted.
ALTER TYPE submission_status_enum RENAME TO review_status_enum;

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

DROP TYPE team_status_enum;

ALTER TABLE event_config
  ADD COLUMN IF NOT EXISTS submission_template_url TEXT;
