import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Append one row to `audit_log`. Shared by every server-action module so the
 * trail stays in one shape no matter which domain wrote it.
 */
export async function log(
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: unknown,
) {
  await db.insert(auditLog).values({
    actorUserId,
    action,
    targetType,
    targetId,
    meta: meta ? JSON.stringify(meta) : null,
  });
}
