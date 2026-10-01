import { after } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Append one row to `audit_log`. Shared by every server-action module so the
 * trail stays in one shape no matter which domain wrote it.
 *
 * The insert runs in `after()`, once the response has gone out. Every caller
 * logs a change that has already committed, so the user gains nothing by
 * waiting another database round trip for the trail to catch up.
 */
export function log(
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: unknown,
) {
  after(async () => {
    try {
      await db.insert(auditLog).values({
        actorUserId,
        action,
        targetType,
        targetId,
        meta: meta ? JSON.stringify(meta) : null,
      });
    } catch (error) {
      console.error("audit_log insert failed", { action, targetId, error });
    }
  });
}
