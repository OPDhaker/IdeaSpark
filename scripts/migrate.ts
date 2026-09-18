import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { pool } from "../src/db";

/**
 * Applies every `drizzle/<tag>/migration.sql` (or `drizzle/<tag>.sql`) that the
 * `schema_migrations` ledger has not recorded yet, one transaction per file.
 *
 * `drizzle-kit migrate` cannot run this folder: the migrations here are hand-written and there is
 * no `drizzle/meta/_journal.json` for it to read. Applying them by hand instead is what left the
 * database half-migrated (teams.status stuck on the old enum), so the ledger lives in the database
 * and each file is all-or-nothing.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Tags that were applied before this runner existed. They are recorded — never replayed — the first
 * time the runner meets a database that already has the schema.
 */
const BASELINE = [
  "20260516010000_ideaspark_prd_baseline",
  "20260516010001_prd_followups",
  "20260918010000_unify_review_status",
  "20260918020000_event_days",
];

type Migration = { tag: string; path: string };

function discover(): Migration[] {
  const migrations: Migration[] = [];

  for (const entry of readdirSync(MIGRATIONS_DIR)) {
    const path = join(MIGRATIONS_DIR, entry);

    if (statSync(path).isDirectory()) {
      const file = join(path, "migration.sql");
      try {
        if (statSync(file).isFile())
          migrations.push({ tag: entry, path: file });
      } catch {
        // A directory without migration.sql (drizzle-kit's `meta`) is not a migration.
      }
      continue;
    }

    if (entry.endsWith(".sql")) {
      migrations.push({ tag: entry.slice(0, -4), path });
    }
  }

  return migrations.sort((a, b) => a.tag.localeCompare(b.tag));
}

const client = await pool.connect();
let failed = false;

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      tag TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const ledger = await client.query<{ tag: string }>(
    "SELECT tag FROM schema_migrations",
  );

  if (ledger.rowCount === 0) {
    const existing = await client.query(
      "SELECT to_regclass('public.teams') AS teams",
    );

    // An empty ledger on a database that already has the schema means this is the first run against
    // a hand-migrated branch. Record the baseline rather than replaying it over live data.
    if (existing.rows[0]?.teams) {
      await client.query(
        "INSERT INTO schema_migrations (tag) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING",
        [BASELINE],
      );
      console.log(
        `Recorded ${BASELINE.length} pre-existing migrations as applied`,
      );
    }
  }

  const applied = new Set(
    (
      await client.query<{ tag: string }>("SELECT tag FROM schema_migrations")
    ).rows.map((row) => row.tag),
  );

  const pending = discover().filter((migration) => !applied.has(migration.tag));

  if (pending.length === 0) {
    console.log("Database is up to date; nothing to apply");
  }

  for (const migration of pending) {
    // The raw client, not drizzle: these files hold multiple statements and `DO $$ … $$` blocks,
    // which only run through the simple query protocol.
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(migration.path, "utf8"));
      await client.query("INSERT INTO schema_migrations (tag) VALUES ($1)", [
        migration.tag,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${migration.tag}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Failed ${migration.tag}: ${(error as Error).message}`);
      failed = true;
      break;
    }
  }
} finally {
  client.release();
  await pool.end();
}

if (failed) process.exitCode = 1;
