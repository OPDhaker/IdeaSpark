"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  type TeamProgress,
  teamProgressEnum,
  teamRoundProgress,
} from "@/db/schema";
import { log } from "@/lib/audit";
import { requireAdminRole } from "@/lib/roles";

const progressSchema = z.object({
  teamId: z.string().uuid(),
  roundId: z.string().uuid(),
  status: z.enum(teamProgressEnum.enumValues),
});

/**
 * Marks where a team is in a round: To be done, Ongoing or Done. One row per
 * team per round, last write wins, so two volunteers tapping the same team
 * simply leave the later mark. It gates nothing, so no lock is needed.
 */
export async function setTeamProgress(input: {
  teamId: string;
  roundId: string;
  status: TeamProgress;
}) {
  const admin = await requireAdminRole(["volunteer", "super_admin"]);
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid team progress");
  const { teamId, roundId, status } = parsed.data;

  await db
    .insert(teamRoundProgress)
    .values({ teamId, roundId, status, updatedBy: admin.id })
    .onConflictDoUpdate({
      target: [teamRoundProgress.teamId, teamRoundProgress.roundId],
      set: { status, updatedBy: admin.id, updatedAt: new Date() },
    });

  log(admin.id, "team.progress", "team", teamId, { roundId, status });
  revalidatePath("/admin/team-panels");
}
