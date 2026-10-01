"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { type DriveLinkFields, recordDriveLinkChecks } from "@/db/transactions";
import { log } from "@/lib/audit";
import { checkDriveLink } from "@/lib/drive";
import { requireAdminRole } from "@/lib/roles";

/** Calls to Google in flight at once: quick for a round, polite to the quota. */
const CONCURRENCY = 8;

/**
 * Re-runs the Drive link check for every submission in a round. A team can make
 * its deck private after submitting, so a submit-time check alone goes stale.
 *
 * An `unverified` result is not written: it says the check failed, not that the
 * link changed, and must not overwrite a status we actually know.
 */
export async function recheckDriveLinks(roundId: string) {
  const admin = await requireAdminRole(["super_admin"]);

  const rows = await db
    .select({ id: submissions.id, driveLink: submissions.driveLink })
    .from(submissions)
    .where(
      and(eq(submissions.roundId, roundId), isNotNull(submissions.driveLink)),
    );

  const counts = { public: 0, restricted: 0, unverified: 0, invalid: 0 };
  const results: Array<{ submissionId: string } & DriveLinkFields> = [];

  for (let start = 0; start < rows.length; start += CONCURRENCY) {
    const batch = rows.slice(start, start + CONCURRENCY);
    const checks = await Promise.all(
      batch.map((row) => checkDriveLink(row.driveLink ?? "")),
    );
    checks.forEach((check, index) => {
      if (!check.ok) {
        // Saved before mime/folder rules existed; nothing to record.
        counts.invalid++;
        return;
      }
      counts[check.status]++;
      if (check.status === "unverified") return;
      results.push({
        submissionId: batch[index].id,
        driveLinkStatus: check.status,
        driveLinkName: check.name,
        driveLinkModifiedAt: check.modifiedAt,
        driveLinkCheckedAt: check.checkedAt,
      });
    });
  }

  await recordDriveLinkChecks(results);

  log(
    admin.id,
    "submission.drive_recheck",
    "evaluation_round",
    roundId,
    counts,
  );
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return counts;
}
