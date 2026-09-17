import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  // Without this, drizzle treats every schema in the database as its own and
  // proposes dropping `neon_auth` — the Managed Better Auth tables holding
  // users, sessions and accounts. Keep push/introspect scoped to `public`.
  schemaFilter: ["public"],
  dbCredentials: {
    url: databaseUrl,
  },
});
