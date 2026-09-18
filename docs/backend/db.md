# Schemas
Find your schemas [here](/src/db/schema.ts).

# Seed and Query the Database
[Documentation](https://orm.drizzle.team/docs/get-started/neon-new#step-7---seed-and-query-the-database).

# Applying Changes to DB

Migrations live in `drizzle/<timestamp>_<name>/migration.sql` and are applied by `scripts/migrate.ts`,
not by `drizzle-kit migrate` — these files are hand-written and there is no `drizzle/meta/_journal.json`
for drizzle-kit to read.

```bash
doppler run -- bun run db:migrate
```

The runner keeps a `schema_migrations` ledger in the database, applies each pending file inside its own
transaction (so a failed file leaves nothing behind), and is a no-op on the second run. Migrations
already applied by hand before the runner existed are recorded from the `BASELINE` list in the script
the first time it meets an existing database.

Workflow for a schema change:

1. Edit `src/db/schema.ts`.
2. `doppler run -- bun run db:generate` to get the diff SQL, then move it into a new
   `drizzle/<timestamp>_<name>/migration.sql` and edit it (data backfills, `IF EXISTS` guards).
3. `doppler run -- bun run db:migrate`, then `doppler run -- bun run db:verify`.

Write migrations idempotently (`IF EXISTS` / `IF NOT EXISTS`, guarded `DO $$` blocks). A torn manual
run is what left `teams.status` on the dropped `team_status_enum` and broke registration; see
`drizzle/20260919010000_repair_review_status/migration.sql`.

`drizzle-kit push` writes straight to the branch with no migration file and no ledger entry. It is a
dev-only shortcut:

```bash
doppler run -- bunx drizzle-kit push
```
