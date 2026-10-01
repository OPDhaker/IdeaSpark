import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { auth } from "@/lib/auth/server";

/**
 * Admin access is "the session's email exists in `admins`", so the identity
 * behind that email has to be one we actually trust.
 *
 * Managed Better Auth still has email/password sign-up enabled at the branch
 * level (`neon_auth.project_config.email_and_password`) with
 * `requireEmailVerification: false`, and the auth base URL is reachable
 * directly, not only through this app. Without this check anyone could
 * register an admin's address against the auth service, never touch Google,
 * and be handed the admin row.
 *
 * Google is the only sign-in method the app offers, so require the session's
 * user to have a Google account and no password credential. A password
 * credential linked onto an admin's user revokes admin rather than granting
 * it — failing closed is the right direction here.
 */
function trustedIdentityColumns(userId: string) {
  return {
    hasGoogle: sql<boolean | null>`(
      SELECT bool_or("providerId" = 'google')
      FROM neon_auth.account WHERE "userId" = ${userId}::uuid
    )`,
    hasPassword: sql<boolean | null>`(
      SELECT bool_or(password IS NOT NULL)
      FROM neon_auth.account WHERE "userId" = ${userId}::uuid
    )`,
  };
}

/**
 * `cache()` makes this one lookup per render: the admin layout and the page
 * under it both ask, and each ask is a database round trip.
 *
 * The admin row and the identity check travel in one query for the same
 * reason. It is still "admin row, then trusted identity" — a session whose
 * email matches no admin returns no row and never reaches the second half.
 */
export const getAdminActor = cache(async () => {
  const { data: session } = await auth.getSession();
  const email = session?.user?.email?.trim().toLowerCase();
  const userId = session?.user?.id;
  if (!email || !userId) return null;

  const [row] = await db
    .select({ admin: admins, ...trustedIdentityColumns(userId) })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

  if (!row) return null;
  if (row.hasGoogle !== true || row.hasPassword === true) return null;

  return row.admin;
});

export async function isAdmin(): Promise<boolean> {
  return Boolean(await getAdminActor());
}

export async function requireAdminRole(
  allowed: Array<typeof admins.$inferSelect.role>,
) {
  const admin = await getAdminActor();
  if (!admin || !allowed.includes(admin.role)) {
    throw new Error("Unauthorized: insufficient admin role");
  }
  return admin;
}
