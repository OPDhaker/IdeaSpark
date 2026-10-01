-- Attendance is opened and closed by a super admin, not by the calendar.
--
-- NULL = closed. Otherwise it is the event day scans are recorded under, and it
-- has to be one of the two configured days: `upsertPanelScoreAtomically` only
-- lets a panel score a team scanned on its round's `event_date`, so a scan
-- filed under any other date would count for nothing.
ALTER TABLE event_config ADD COLUMN attendance_day DATE;

ALTER TABLE event_config
  ADD CONSTRAINT event_config_attendance_day_is_event_day
  CHECK (attendance_day IS NULL OR attendance_day IN (day_one, day_two));
