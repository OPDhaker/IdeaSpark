-- Records whether a submission's Drive link is viewable without signing in.
--
-- Checked against the Drive API on submit and again when a super admin
-- rechecks a round. NULL = submitted before the check existed. `unverified` =
-- the check failed (no key, Google down) and the link was let through anyway.
-- `drive_link_modified_at` is Drive's modifiedTime, used to flag decks edited
-- after the submission deadline.
CREATE TYPE drive_link_status_enum AS ENUM ('public', 'restricted', 'unverified');

ALTER TABLE submissions
  ADD COLUMN drive_link_status drive_link_status_enum,
  ADD COLUMN drive_link_name VARCHAR(255),
  ADD COLUMN drive_link_modified_at TIMESTAMPTZ,
  ADD COLUMN drive_link_checked_at TIMESTAMPTZ;
