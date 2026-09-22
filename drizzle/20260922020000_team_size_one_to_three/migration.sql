-- Team size moves from 2-4 to 1-3 members, leader included.
--
-- Both triggers below are (re)created rather than altered: the baseline tag was
-- *recorded* by scripts/migrate.ts on an already-pushed branch instead of being
-- replayed, so neither function nor trigger exists in that database. The
-- statements are idempotent, so this file is correct on both a branch that has
-- them and one that never did.

-- Refuse to run against data the new maximum cannot hold. The runner wraps each
-- file in one transaction, so this aborts the whole migration.
DO $$
DECLARE
  oversized INTEGER;
BEGIN
  SELECT count(*) INTO oversized
  FROM (SELECT team_id FROM members GROUP BY team_id HAVING count(*) > 3) AS t;

  IF oversized > 0 THEN
    RAISE EXCEPTION
      '% team(s) still have more than 3 members; shrink them before applying this migration',
      oversized;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_team_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.team_id::text));
  SELECT count(*) INTO current_count FROM members WHERE team_id = NEW.team_id;
  IF current_count >= 3 THEN
    RAISE EXCEPTION 'Team is full (maximum 3 members)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_member_limit_trigger ON members;

CREATE TRIGGER team_member_limit_trigger
BEFORE INSERT ON members
FOR EACH ROW
EXECUTE FUNCTION enforce_team_member_limit();

-- Unchanged in substance -- restored here because it is missing for the same
-- reason. This is the body from 20260516010001_prd_followups, which supersedes
-- the baseline copy.
CREATE OR REPLACE FUNCTION prevent_paid_team_roster_changes()
RETURNS TRIGGER AS $$
DECLARE
  locked BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT payment_status = 'paid' INTO locked
    FROM teams WHERE id = NEW.team_id FOR SHARE;
  ELSE
    SELECT payment_status = 'paid' INTO locked
    FROM teams WHERE id = OLD.team_id FOR SHARE;
  END IF;

  IF COALESCE(locked, FALSE) THEN
    RAISE EXCEPTION 'Roster is locked after payment';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    SELECT payment_status = 'paid' INTO locked
    FROM teams WHERE id = NEW.team_id FOR SHARE;

    IF COALESCE(locked, FALSE) THEN
      RAISE EXCEPTION 'Destination roster is locked after payment';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_paid_team_roster_changes_trigger ON members;

CREATE TRIGGER prevent_paid_team_roster_changes_trigger
BEFORE INSERT OR DELETE OR UPDATE OF team_id ON members
FOR EACH ROW
EXECUTE FUNCTION prevent_paid_team_roster_changes();
