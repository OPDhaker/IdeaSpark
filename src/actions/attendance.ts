"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  findTeamByAttendanceCode,
  getTeamAttendanceRoster,
} from "@/db/queries";
import { eventConfig } from "@/db/schema";
import { setTeamAttendanceAtomically } from "@/db/transactions";
import { log } from "@/lib/audit";
import { requireAdminRole } from "@/lib/roles";

const SCAN_ROLES = ["volunteer", "super_admin"] as const;

async function getAttendanceConfig() {
  const [cfg] = await db
    .select({
      attendanceDay: eventConfig.attendanceDay,
      dayOne: eventConfig.dayOne,
      dayTwo: eventConfig.dayTwo,
    })
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  if (!cfg) throw new Error("Event configuration is not initialized");
  return cfg;
}

/**
 * The day a scan is filed under: whichever event day a super admin opened
 * attendance for, never the client's choice and never the wall clock. Read
 * fresh on every call, so closing attendance stops a sheet that is already
 * open from saving.
 */
async function resolveScanDate() {
  const { attendanceDay } = await getAttendanceConfig();
  if (!attendanceDay) throw new Error("Attendance is closed");
  return attendanceDay;
}

export type TeamAttendance = {
  eventDate: string;
  team: { id: string; teamName: string; trackName: string | null };
  members: Awaited<ReturnType<typeof getTeamAttendanceRoster>>;
};

/** What the scanner page needs before any scan: is attendance open. */
export async function getScanContext() {
  const admin = await requireAdminRole([...SCAN_ROLES]);
  const cfg = await getAttendanceConfig();
  return {
    canToggle: admin.role === "super_admin",
    eventDate: cfg.attendanceDay,
    dayLabel:
      cfg.attendanceDay === cfg.dayOne
        ? "Day 1"
        : cfg.attendanceDay === cfg.dayTwo
          ? "Day 2"
          : null,
  };
}

/**
 * Opens the door scanner for one event day, or closes it. Takes the slot, not
 * a date, so the client cannot file scans under a day the event does not run;
 * `event_config_attendance_day_is_event_day` enforces the same in Postgres.
 */
export async function setAttendanceDay(slot: "day_one" | "day_two" | null) {
  const admin = await requireAdminRole(["super_admin"]);
  if (slot !== null && slot !== "day_one" && slot !== "day_two")
    throw new Error("Invalid attendance day");

  const [config] = await db
    .update(eventConfig)
    .set({
      attendanceDay:
        slot === "day_one"
          ? sql`${eventConfig.dayOne}`
          : slot === "day_two"
            ? sql`${eventConfig.dayTwo}`
            : null,
      updatedAt: new Date(),
    })
    .where(eq(eventConfig.id, 1))
    .returning({ attendanceDay: eventConfig.attendanceDay });
  if (!config) throw new Error("Event configuration is not initialized");

  await log(admin.id, "attendance.open", "event_config", "1", {
    attendanceDay: config.attendanceDay,
  });
  revalidatePath("/admin/event");
  revalidatePath("/admin/attendance");
  return config;
}

const codeSchema = z.string().trim().min(1).max(128);

/** Resolves a scanned team pass to its roster and the open day's attendance. */
export async function lookupTeamAttendance(
  code: string,
): Promise<TeamAttendance> {
  await requireAdminRole([...SCAN_ROLES]);
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) throw new Error("Invalid attendance code");

  const eventDate = await resolveScanDate();
  const team = await findTeamByAttendanceCode(parsed.data);
  if (!team) throw new Error("Invalid attendance code");
  if (team.paymentStatus !== "paid")
    throw new Error("This team has not paid yet");

  return {
    eventDate,
    team: { id: team.id, teamName: team.teamName, trackName: team.trackName },
    members: await getTeamAttendanceRoster(team.id, eventDate),
  };
}

const changesSchema = z.object({
  teamId: z.uuid(),
  changes: z
    .array(z.object({ memberId: z.uuid(), present: z.boolean() }))
    .max(16),
});

/**
 * Applies only the members the volunteer changed, so two volunteers on the
 * same team never overwrite each other's marks. Returns the fresh roster so a
 * stale sheet catches up with whatever the other volunteer did.
 */
export async function setTeamAttendance(input: {
  teamId: string;
  changes: Array<{ memberId: string; present: boolean }>;
}) {
  const admin = await requireAdminRole([...SCAN_ROLES]);
  const parsed = changesSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid attendance update");

  const { teamId, changes } = parsed.data;
  const eventDate = await resolveScanDate();

  const result = await setTeamAttendanceAtomically({
    teamId,
    eventDate,
    adminId: admin.id,
    mark: changes.filter((c) => c.present).map((c) => c.memberId),
    unmark: changes.filter((c) => !c.present).map((c) => c.memberId),
  });

  if (result.marked.length)
    await log(admin.id, "attendance.mark", "team", teamId, {
      eventDate,
      memberIds: result.marked,
    });
  if (result.unmarked.length)
    await log(admin.id, "attendance.unmark", "team", teamId, {
      eventDate,
      memberIds: result.unmarked,
    });

  revalidatePath("/admin");

  return {
    marked: result.marked.length,
    unmarked: result.unmarked.length,
    members: await getTeamAttendanceRoster(teamId, eventDate),
  };
}
