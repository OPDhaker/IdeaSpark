SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'tracks','departments','admins','teams','members','submissions',
    'attendance','evaluation_rounds','scores','event_config',
    'announcements','audit_log'
  )
ORDER BY table_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'one_leader_per_team',
    'attendance_member_date_unique',
    'evaluation_rounds_one_active_unique',
    'scores_team_round_evaluator_unique',
    'team_panel_assignments_team_round_type_unique',
    'panels_id_type_unique'
  )
ORDER BY indexname;

SELECT conname
FROM pg_constraint
WHERE conrelid IN ('scores'::regclass, 'team_panel_assignments'::regclass)
  AND conname IN ('scores_shape', 'team_panel_assignments_panel_fk')
ORDER BY conname;

SELECT tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname = 'members'
  AND NOT t.tgisinternal
ORDER BY tgname;
