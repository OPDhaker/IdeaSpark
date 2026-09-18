DO $$
BEGIN
  CREATE TYPE team_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE teams
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE teams
  ALTER COLUMN status TYPE team_status_enum
  USING (
    CASE status::text
      WHEN 'pending_submission' THEN 'pending'::team_status_enum
      WHEN 'in_review' THEN 'pending'::team_status_enum
      WHEN 'accepted' THEN 'approved'::team_status_enum
      WHEN 'rejected' THEN 'rejected'::team_status_enum
      ELSE 'pending'::team_status_enum
    END
  );

ALTER TABLE teams
  ALTER COLUMN status SET DEFAULT 'pending'::team_status_enum;