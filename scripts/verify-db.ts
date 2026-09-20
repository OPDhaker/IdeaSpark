import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";

const expected = [
  "tracks",
  "departments",
  "admins",
  "teams",
  "members",
  "submissions",
  "payments",
  "attendance",
  "evaluation_rounds",
  "scores",
  "event_config",
  "announcements",
  "audit_log",
  "panels",
  "panel_members",
  "team_panel_assignments",
];

const rows = await db.execute(sql`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name = any(${sql.raw(`ARRAY[${expected.map((x) => `'${x}'`).join(",")}]`)})
  order by table_name
`);

const names = new Set(rows.rows.map((row) => String(row.table_name)));
const missing = expected.filter((name) => !names.has(name));
if (missing.length) {
  console.error(`Missing tables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Database OK: ${expected.length} expected tables present`);
}

await pool.end();
