import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");

// A new connection is a WebSocket + TLS + startup handshake, several round
// trips to the database before the first query. pg's default drops an idle
// connection after 10s, so a pause between two clicks paid that handshake
// again. A minute keeps them warm and stays well under Neon's autosuspend.
//
// Dev keeps the pool on `globalThis` so a hot reload reuses it instead of
// opening a fresh, cold one beside the old.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS ?? 60_000),
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle({ client: pool });
export { pool };
export * as schema from "./schema";
