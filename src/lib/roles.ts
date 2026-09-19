import { eq, sql } from "drizzle-orm";
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
async function hasTrustedIdentity(userId: string): Promise<boolean> {
  const { rows } = await db.execute<{
    has_google: boolean | null;
    has_password: boolean | null;
  }>(sql`
    SELECT
      bool_or("providerId" = 'google') AS has_google,
      bool_or(password IS NOT NULL)   AS has_password
    FROM neon_auth.account
    WHERE "userId" = ${userId}::uuid
  `);

  const row = rows[0];
  return row?.has_google === true && row.has_password !== true;
}

export async function getAdminActor() {
  const { data: session } = await auth.getSession();
  const email = session?.user?.email?.trim().toLowerCase();
  const userId = session?.user?.id;
  if (!email || !userId) return null;

  // Cheap path first: most sessions are not admins at all, and that costs one
  // query either way. Only pay for the identity check once the email matches.
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

  if (!admin) return null;
  if (!(await hasTrustedIdentity(userId))) return null;

  return admin;
}

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
