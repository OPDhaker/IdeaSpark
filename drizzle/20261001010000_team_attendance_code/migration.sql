-- One door pass per team instead of one per member. A volunteer scans the
-- team's code, then marks each member present individually.
ALTER TABLE teams ADD COLUMN attendance_code VARCHAR(128);

UPDATE teams
SET attendance_code = gen_random_uuid()::text
WHERE payment_status = 'paid';

ALTER TABLE teams
  ADD CONSTRAINT teams_attendance_code_unique UNIQUE (attendance_code);

ALTER TABLE teams
  ADD CONSTRAINT teams_paid_has_attendance_code
  CHECK (payment_status <> 'paid' OR attendance_code IS NOT NULL);

ALTER TABLE members DROP COLUMN attendance_code;
