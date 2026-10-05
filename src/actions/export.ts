"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { formatMoment } from "@/app/(adminRoutes)/admin/_lib/format";
import {
  filterTeams,
  type ReviewStatus,
  sortTeams,
  type TeamFilters,
  type TeamSort,
} from "@/app/(adminRoutes)/admin/_lib/team-filters";
import {
  EXPORT_COLUMN_KEYS,
  EXPORT_COLUMNS,
  type ExportColumn,
} from "@/app/(adminRoutes)/admin/export/_lib/columns";
import { db } from "@/db";
import { getEventConfig, getPanelsWithJudges } from "@/db/queries";
import {
  attendance,
  departments,
  evaluationRounds,
  members,
  PANEL_TYPE_KEYS,
  PANEL_TYPES,
  type PanelType,
  submissions,
  teamPanelAssignments,
  teams,
  tracks,
} from "@/db/schema";
import { log } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { requireAdminRole } from "@/lib/roles";

const optionsSchema = z.object({
  filters: z.object({
    query: z.string().max(255),
    trackId: z.string().max(64),
    submission: z.enum(["all", "submitted", "not_submitted"]),
    payment: z.enum(["all", "paid", "unpaid"]),
    decision: z.enum([
      "all",
      "pending_submission",
      "in_review",
      "rejected",
      "accepted",
    ]),
  }),
  sort: z.enum(["newest", "oldest", "name_asc", "name_desc", "track"]),
  columns: z.array(z.enum(EXPORT_COLUMN_KEYS)).min(1),
});

export type ExportOptions = {
  filters: TeamFilters;
  sort: TeamSort;
  columns: ExportColumn[];
};

const SUBMISSION_STATE: Record<ReviewStatus, string> = {
  pending_submission: "Not submitted",
  in_review: "In review",
  accepted: "Accepted",
  rejected: "Rejected",
};

async function loadExportRows() {
  return (
    db
      .select({
        id: teams.id,
        teamName: teams.teamName,
        trackId: teams.trackId,
        trackName: tracks.name,
        status: teams.status,
        paymentStatus: teams.paymentStatus,
        paymentId: teams.paymentId,
        createdAt: teams.createdAt,
        leaderName: members.name,
        leaderPhone: members.phoneNumber,
        leaderRaNumber: members.raNumber,
        leaderNetId: members.netId,
        leaderDepartment: departments.label,
        // The leader's Google address lives with Managed Better Auth, not in
        // `members`. Compared as text so a malformed id can't fail the export.
        leaderEmail: sql<string | null>`(
        SELECT email FROM neon_auth."user" WHERE id::text = ${teams.leadUserId}
      )`,
        memberCount: sql<number>`(
        SELECT count(*)::int FROM members m WHERE m.team_id = ${teams.id}
      )`,
        otherMembers: sql<string | null>`(
        SELECT string_agg(m.name || ' (' || m.phone_number || ')', '; ' ORDER BY m.created_at)
        FROM members m WHERE m.team_id = ${teams.id} AND NOT m.is_leader
      )`,
        deckLink: submissions.driveLink,
        deckLinkStatus: submissions.driveLinkStatus,
        submittedAt: submissions.submittedAt,
      })
      .from(teams)
      .leftJoin(tracks, eq(teams.trackId, tracks.id))
      .leftJoin(
        members,
        and(eq(members.teamId, teams.id), eq(members.isLeader, true)),
      )
      .leftJoin(departments, eq(members.departmentCode, departments.code))
      // At most one round is active (partial unique index), so this joins at
      // most one submission per team.
      .leftJoin(evaluationRounds, eq(evaluationRounds.isActive, true))
      .leftJoin(
        submissions,
        and(
          eq(submissions.teamId, teams.id),
          eq(submissions.roundId, evaluationRounds.id),
        ),
      )
  );
}

type ExportRow = Awaited<ReturnType<typeof loadExportRows>>[number];

const VALUE: Record<ExportColumn, (row: ExportRow) => string | number | null> =
  {
    teamName: (r) => r.teamName,
    track: (r) => r.trackName,
    leaderName: (r) => r.leaderName,
    leaderPhone: (r) => r.leaderPhone,
    paymentStatus: (r) => (r.paymentStatus === "paid" ? "Paid" : "Unpaid"),
    submissionState: (r) => SUBMISSION_STATE[r.status],
    leaderEmail: (r) => r.leaderEmail,
    leaderRaNumber: (r) => r.leaderRaNumber,
    leaderNetId: (r) => r.leaderNetId,
    leaderDepartment: (r) => r.leaderDepartment,
    memberCount: (r) => r.memberCount,
    otherMembers: (r) => r.otherMembers,
    paymentId: (r) => r.paymentId,
    deckLink: (r) => r.deckLink,
    deckLinkStatus: (r) => r.deckLinkStatus,
    submittedAt: (r) => (r.submittedAt ? formatMoment(r.submittedAt) : null),
    registeredAt: (r) => formatMoment(r.createdAt),
  };

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * Every team as one CSV row, filtered and sorted exactly like the `/admin`
 * list (same `filterTeams` / `sortTeams`), with the columns the caller picked
 * in `EXPORT_COLUMNS` order. Returned as text; the browser saves it.
 */
export async function exportTeamsCsv(options: ExportOptions) {
  const admin = await requireAdminRole(["super_admin"]);
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) throw new Error("Invalid export options");
  const { filters, sort, columns } = parsed.data;

  const picked = EXPORT_COLUMNS.filter((c) => columns.includes(c.key));
  const rows = sortTeams(filterTeams(await loadExportRows(), filters), sort);

  const csv = toCsv(
    picked.map((c) => c.label),
    rows.map((row) => picked.map((c) => VALUE[c.key](row))),
  );

  // Phone numbers and member names leave the app here.
  log(admin.id, "teams.export", "team", "all", {
    filters,
    sort,
    columns: picked.map((c) => c.key),
    rows: rows.length,
  });

  return {
    filename: `ideaspark-teams-${today.format(new Date())}.csv`,
    csv,
    rowCount: rows.length,
  };
}

const odDaySchema = z.enum(["day_one", "day_two"]);

/**
 * Every member scanned in on one event day, for department OD letters. The
 * client names the day, never a date: the date comes from `event_config`, so
 * a list can only ever be for an event day.
 *
 * Sorted by department, then faculty advisor, so each department's (and each
 * FA's) students sit in one block that can be cut out and sent on.
 */
export async function exportOdListCsv(day: "day_one" | "day_two") {
  const admin = await requireAdminRole(["super_admin"]);
  const parsed = odDaySchema.safeParse(day);
  if (!parsed.success) throw new Error("Invalid event day");

  const config = await getEventConfig();
  if (!config) throw new Error("Event configuration is not initialized");
  const date = parsed.data === "day_one" ? config.dayOne : config.dayTwo;

  const rows = await db
    .select({
      name: members.name,
      raNumber: members.raNumber,
      netId: members.netId,
      department: departments.label,
      facultyName: members.facultyName,
      facultyEmail: members.facultyEmail,
    })
    .from(attendance)
    .innerJoin(members, eq(attendance.memberId, members.id))
    .leftJoin(departments, eq(members.departmentCode, departments.code))
    .where(eq(attendance.eventDate, date))
    .orderBy(
      asc(departments.label),
      asc(members.facultyName),
      asc(members.name),
    );

  const csv = toCsv(
    [
      "S.No.",
      "Name",
      "RA Number",
      "Net ID",
      "Department",
      "FA Name",
      "FA Email",
    ],
    rows.map((r, index) => [
      index + 1,
      r.name,
      r.raNumber,
      r.netId,
      r.department,
      r.facultyName,
      r.facultyEmail,
    ]),
  );

  log(admin.id, "attendance.od_export", "event_config", "1", {
    day: parsed.data,
    date,
    rows: rows.length,
  });

  const dayNumber = parsed.data === "day_one" ? 1 : 2;
  return {
    filename: `ideaspark-od-list-day-${dayNumber}-${date}.csv`,
    csv,
    rowCount: rows.length,
  };
}

const roundIdSchema = z.string().uuid();

/**
 * Who judges whom in one round: one row per team per panel, grouped by panel,
 * each row carrying the tracks its panel covers and the panel's judges. An
 * accepted, paid team still missing a panel of some type gets an `Unassigned`
 * row for that type, so the gaps are on the sheet rather than discovered in
 * the room.
 */
export async function exportPanelAssignmentsCsv(roundId: string) {
  const admin = await requireAdminRole(["super_admin"]);
  const parsed = roundIdSchema.safeParse(roundId);
  if (!parsed.success) throw new Error("Invalid round");

  const [[round], { panels, judges }, assigned, eligible] = await Promise.all([
    db
      .select({ id: evaluationRounds.id, slug: evaluationRounds.slug })
      .from(evaluationRounds)
      .where(eq(evaluationRounds.id, parsed.data))
      .limit(1),
    getPanelsWithJudges(),
    db
      .select({
        panelId: teamPanelAssignments.panelId,
        panelType: teamPanelAssignments.panelType,
        teamId: teams.id,
        teamName: teams.teamName,
        trackName: tracks.name,
      })
      .from(teamPanelAssignments)
      .innerJoin(teams, eq(teamPanelAssignments.teamId, teams.id))
      .leftJoin(tracks, eq(teams.trackId, tracks.id))
      .where(eq(teamPanelAssignments.roundId, parsed.data)),
    db
      .select({
        teamId: teams.id,
        teamName: teams.teamName,
        trackName: tracks.name,
      })
      .from(teams)
      .leftJoin(tracks, eq(teams.trackId, tracks.id))
      .where(
        and(eq(teams.status, "accepted"), eq(teams.paymentStatus, "paid")),
      ),
  ]);
  if (!round) throw new Error("Evaluation round not found");

  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const tracksOf = new Map<string, Set<string>>();
  for (const row of assigned) {
    const set = tracksOf.get(row.panelId) ?? new Set<string>();
    if (row.trackName) set.add(row.trackName);
    tracksOf.set(row.panelId, set);
  }
  const judgesOf = (panelId: string) =>
    judges
      .filter((judge) => judge.panelId === panelId)
      .map((judge) => judge.name)
      .join("; ");

  const typeOrder = (type: PanelType) => PANEL_TYPE_KEYS.indexOf(type);
  const byText = (a: string | null, b: string | null) =>
    (a ?? "").localeCompare(b ?? "");

  const rows = assigned
    .map((row) => ({
      ...row,
      panelName: panelById.get(row.panelId)?.name ?? "",
    }))
    .sort(
      (a, b) =>
        typeOrder(a.panelType) - typeOrder(b.panelType) ||
        byText(a.panelName, b.panelName) ||
        byText(a.trackName, b.trackName) ||
        byText(a.teamName, b.teamName),
    )
    .map((row) => [
      row.panelName,
      PANEL_TYPES[row.panelType].label,
      [...(tracksOf.get(row.panelId) ?? [])].sort().join("; "),
      row.teamName,
      row.trackName,
      judgesOf(row.panelId),
    ]);

  const slots = new Set(
    assigned.map((row) => `${row.teamId}:${row.panelType}`),
  );
  const unassigned = PANEL_TYPE_KEYS.flatMap((type) =>
    eligible
      .filter((team) => !slots.has(`${team.teamId}:${type}`))
      .sort(
        (a, b) =>
          byText(a.trackName, b.trackName) || byText(a.teamName, b.teamName),
      )
      .map((team) => [
        "Unassigned",
        PANEL_TYPES[type].label,
        null,
        team.teamName,
        team.trackName,
        null,
      ]),
  );

  const csv = toCsv(
    ["Panel", "Panel type", "Panel tracks", "Team", "Team track", "Judges"],
    [...rows, ...unassigned],
  );

  log(admin.id, "panels.export", "evaluation_round", round.id, {
    assigned: rows.length,
    unassigned: unassigned.length,
  });

  return {
    filename: `ideaspark-panels-${round.slug}-${today.format(new Date())}.csv`,
    csv,
    rowCount: rows.length,
    unassignedCount: unassigned.length,
  };
}
