import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  admins,
  attendance,
  departments,
  evaluationRounds,
  eventConfig,
  members,
  panelMembers,
  panels,
  scores,
  submissions,
  teamPanelAssignments,
  teams,
  tracks,
} from "./schema";
import type { ReviewStatus } from "./transactions";

export async function getActiveTracks() {
  return db
    .select()
    .from(tracks)
    .where(eq(tracks.isActive, true))
    .orderBy(tracks.name);
}

export async function getDepartments() {
  return db.select().from(departments).orderBy(departments.label);
}

export async function getTeamByLeader(leadUserId: string) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.leadUserId, leadUserId))
    .limit(1);
  return team ?? null;
}

export async function getTeamDashboard(teamId: string) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return null;

  const [teamMembers, teamSubmissions] = await Promise.all([
    db
      .select()
      .from(members)
      .where(eq(members.teamId, teamId))
      .orderBy(members.name),
    db
      .select()
      .from(submissions)
      .where(eq(submissions.teamId, teamId))
      .orderBy(submissions.roundId),
  ]);

  return { team, members: teamMembers, submissions: teamSubmissions };
}

export async function getAttendanceForTeam(teamId: string) {
  return db
    .select({
      memberId: members.id,
      memberName: members.name,
      eventDate: attendance.eventDate,
      scannedAt: attendance.scannedAt,
    })
    .from(members)
    .leftJoin(attendance, eq(attendance.memberId, members.id))
    .where(eq(members.teamId, teamId))
    .orderBy(members.name, attendance.eventDate);
}

/**
 * A team's score is its panel's *per-criterion* mean, summed — not the mean of
 * the judges' totals. With all four criteria required the two are the same
 * number; averaging per criterion is what lets a caller show the breakdown
 * behind the total.
 *
 * Out of 50. The inner join on `scores` keeps an unscored team off the board
 * entirely rather than ranking it last, so an empty board is the normal state
 * until judging starts.
 */
const panelMean = {
  problemUnderstanding: sql<string>`coalesce(avg(${scores.problemUnderstanding}), 0)`,
  ideaFeasibility: sql<string>`coalesce(avg(${scores.ideaFeasibility}), 0)`,
  decisionMaking: sql<string>`coalesce(avg(${scores.decisionMaking}), 0)`,
  coordination: sql<string>`coalesce(avg(${scores.coordination}), 0)`,
};

const panelTotal = sql<string>`
  coalesce(avg(${scores.problemUnderstanding}), 0)
  + coalesce(avg(${scores.ideaFeasibility}), 0)
  + coalesce(avg(${scores.decisionMaking}), 0)
  + coalesce(avg(${scores.coordination}), 0)
`;

export async function getLeaderboard() {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.teamName,
      trackName: tracks.name,
      judgeCount: sql<number>`count(distinct ${scores.evaluatorId})::int`,
      ...panelMean,
      averageScore: panelTotal,
    })
    .from(scores)
    .innerJoin(teams, eq(scores.teamId, teams.id))
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .where(and(eq(teams.paymentStatus, "paid"), eq(teams.status, "accepted")))
    .groupBy(teams.id, teams.teamName, tracks.name)
    .orderBy(desc(panelTotal));
}

/**
 * The same board scoped to one round, for the judging panel. No day-one gate:
 * judges need it live, during the round it describes.
 */
export async function getPanelLeaderboardRows(roundId: string) {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.teamName,
      trackName: tracks.name,
      judgeCount: sql<number>`count(distinct ${scores.evaluatorId})::int`,
      ...panelMean,
      averageScore: panelTotal,
    })
    .from(scores)
    .innerJoin(teams, eq(scores.teamId, teams.id))
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .where(
      and(
        eq(scores.roundId, roundId),
        eq(teams.paymentStatus, "paid"),
        eq(teams.status, "accepted"),
      ),
    )
    .groupBy(teams.id, teams.teamName, tracks.name)
    .orderBy(desc(panelTotal));
}

export async function getPanelForAdmin(
  adminId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: panels.id, name: panels.name })
    .from(panelMembers)
    .innerJoin(panels, eq(panelMembers.panelId, panels.id))
    .where(eq(panelMembers.adminId, adminId))
    .limit(1);
  return row ?? null;
}

export async function getPanelJudges(panelId: string) {
  return db
    .select({ id: admins.id, name: admins.name, email: admins.email })
    .from(panelMembers)
    .innerJoin(admins, eq(panelMembers.adminId, admins.id))
    .where(eq(panelMembers.panelId, panelId))
    .orderBy(asc(admins.name));
}

export async function getRoundBySlug(
  slug: string,
): Promise<typeof evaluationRounds.$inferSelect | null> {
  const [round] = await db
    .select()
    .from(evaluationRounds)
    .where(eq(evaluationRounds.slug, slug))
    .limit(1);
  return round ?? null;
}

export async function listEvaluationRounds() {
  return db
    .select()
    .from(evaluationRounds)
    .orderBy(asc(evaluationRounds.sequenceNo));
}

/**
 * The teams judgeable in one round: accepted, paid, and physically present on
 * the round's day.
 *
 * `panelId` scopes it to one panel's assignments. Passing `null` returns every
 * judgeable team in the round with whichever panel owns it (or none) attached —
 * that is the super-admin view, and it is read-only: writing a score still
 * requires the evaluator to sit on the team's own panel, which
 * `upsertPanelScoreAtomically` enforces.
 *
 * Ordered by team name A-Z and never filtered by whether a judge has scored
 * yet, so prev/next stays put under someone's hand as they save.
 */
export async function getPanelQueue(input: {
  roundId: string;
  panelId: string | null;
  eventDate: string;
}) {
  const present = sql`EXISTS (
    SELECT 1
    FROM ${attendance} a
    JOIN ${members} m ON m.id = a.member_id
    WHERE m.team_id = ${teams.id}
      AND a.event_date = ${input.eventDate}
  )`;

  const teamRows = await db
    .select({
      id: teams.id,
      teamName: teams.teamName,
      trackName: tracks.name,
      status: teams.status,
      panelId: teamPanelAssignments.panelId,
      panelName: panels.name,
    })
    .from(teams)
    // A left join, so the unscoped view still lists a team no panel owns yet.
    .leftJoin(
      teamPanelAssignments,
      and(
        eq(teamPanelAssignments.teamId, teams.id),
        eq(teamPanelAssignments.roundId, input.roundId),
      ),
    )
    .leftJoin(panels, eq(teamPanelAssignments.panelId, panels.id))
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .where(
      and(
        eq(teams.status, "accepted"),
        eq(teams.paymentStatus, "paid"),
        present,
        input.panelId
          ? eq(teamPanelAssignments.panelId, input.panelId)
          : undefined,
      ),
    )
    .orderBy(asc(teams.teamName));

  if (teamRows.length === 0)
    return { teams: teamRows, scores: [] as PanelQueueScore[] };

  // Every judge's row, not only the caller's: peer scores are shown on the
  // sheet. A team belongs to one panel per round, so these are that panel's
  // judges without having to filter on the roster.
  const scoreRows = await db
    .select({
      teamId: scores.teamId,
      evaluatorId: scores.evaluatorId,
      evaluatorName: admins.name,
      problemUnderstanding: scores.problemUnderstanding,
      ideaFeasibility: scores.ideaFeasibility,
      decisionMaking: scores.decisionMaking,
      coordination: scores.coordination,
      score: scores.score,
      remarks: scores.remarks,
    })
    .from(scores)
    .innerJoin(admins, eq(scores.evaluatorId, admins.id))
    .where(
      and(
        eq(scores.roundId, input.roundId),
        inArray(
          scores.teamId,
          teamRows.map((t) => t.id),
        ),
      ),
    )
    .orderBy(asc(admins.name));

  return { teams: teamRows, scores: scoreRows };
}

type PanelQueueScore = {
  teamId: string;
  evaluatorId: string;
  evaluatorName: string;
  problemUnderstanding: string;
  ideaFeasibility: string;
  decisionMaking: string;
  coordination: string;
  score: string | null;
  remarks: string | null;
};

/** Panels with how many teams each holds in a round — the panel switcher. */
export async function getPanelCounts(roundId: string) {
  return db
    .select({
      id: panels.id,
      name: panels.name,
      teamCount: sql<number>`count(${teamPanelAssignments.teamId})::int`,
    })
    .from(panels)
    .leftJoin(
      teamPanelAssignments,
      and(
        eq(teamPanelAssignments.panelId, panels.id),
        eq(teamPanelAssignments.roundId, roundId),
      ),
    )
    .groupBy(panels.id, panels.name)
    .orderBy(asc(panels.name));
}

/** Every panel with its judges and how many teams it holds in a round. */
export async function getPanelsWithJudges() {
  const panelRows = await db
    .select({ id: panels.id, name: panels.name })
    .from(panels)
    .orderBy(asc(panels.name));

  const judgeRows = await db
    .select({
      panelId: panelMembers.panelId,
      adminId: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
    })
    .from(panelMembers)
    .innerJoin(admins, eq(panelMembers.adminId, admins.id))
    .orderBy(asc(admins.name));

  return { panels: panelRows, judges: judgeRows };
}

export async function listAssignments(roundId: string) {
  return db
    .select({
      teamId: teamPanelAssignments.teamId,
      panelId: teamPanelAssignments.panelId,
    })
    .from(teamPanelAssignments)
    .where(eq(teamPanelAssignments.roundId, roundId));
}

export async function getEventConfig() {
  const [config] = await db
    .select()
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  return config ?? null;
}

export async function getActiveRound() {
  const [round] = await db
    .select()
    .from(evaluationRounds)
    .where(eq(evaluationRounds.isActive, true))
    .limit(1);
  return round ?? null;
}

export async function listAdminTeams(filters?: {
  status?: ReviewStatus;
  trackId?: string;
  search?: string;
}) {
  const conditions = [];
  if (filters?.status) conditions.push(eq(teams.status, filters.status));
  if (filters?.trackId) conditions.push(eq(teams.trackId, filters.trackId));
  if (filters?.search)
    conditions.push(ilike(teams.teamName, `%${filters.search}%`));

  return db
    .select({
      id: teams.id,
      teamName: teams.teamName,
      status: teams.status,
      paymentStatus: teams.paymentStatus,
      trackId: teams.trackId,
      trackName: tracks.name,
    })
    .from(teams)
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(teams.createdAt));
}

export async function findMemberByAttendanceCode(attendanceCode: string) {
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.attendanceCode, attendanceCode))
    .limit(1);
  return member ?? null;
}
