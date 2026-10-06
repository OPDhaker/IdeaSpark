import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import { db } from "./index";
import {
  admins,
  attendance,
  DAY_TWO_QUALIFIERS,
  departments,
  evaluationRounds,
  eventConfig,
  members,
  type PanelType,
  panelMembers,
  panels,
  scores,
  submissions,
  type TeamProgress,
  teamPanelAssignments,
  teamRoundProgress,
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

/*
 * Scoring math, shared by both boards.
 *
 * A team's day is two panel means: Panel Type 1's four criteria, each averaged
 * across that panel's judges and then summed (/90), plus Panel Type 2's Risk
 * Management mean (/10) — /100 a day. `avg()` skips NULLs, and a row only
 * fills its own type's columns, so each criterion is averaged over exactly the
 * judges who score it. A type nobody has scored yet averages to NULL, which is
 * how "incomplete" is told apart from "scored zero".
 *
 * The inner join on `scores` keeps an unscored team off the board entirely
 * rather than ranking it last, so an empty board is the normal state until
 * judging starts.
 */

type RawDayRow = {
  team_id: string;
  team_name: string;
  track_name: string | null;
  main_judges: number;
  risk_judges: number;
  problem_understanding: string | null;
  idea_feasibility: string | null;
  decision_making: string | null;
  coordination: string | null;
  risk_management: string | null;
  main_total: string | null;
  risk_total: string | null;
  day_total: string;
  complete: boolean;
};

/**
 * One round (one event day) for the judging panel. No publish gate: judges
 * need it live, during the round it describes. A team one panel type has
 * scored and the other has not is still listed, flagged `complete: false` and
 * sorted after the complete ones, so judges can see who is still waiting.
 */
export async function getPanelLeaderboardRows(roundId: string) {
  const { rows } = await db.execute<RawDayRow>(sql`
    WITH day AS (
      SELECT
        s.team_id,
        count(*) FILTER (WHERE s.panel_type = 'main')::int AS main_judges,
        count(*) FILTER (WHERE s.panel_type = 'risk')::int AS risk_judges,
        avg(s.problem_understanding) AS problem_understanding,
        avg(s.idea_feasibility) AS idea_feasibility,
        avg(s.decision_making) AS decision_making,
        avg(s.coordination) AS coordination,
        avg(s.risk_management) AS risk_management
      FROM ${scores} s
      WHERE s.round_id = ${roundId}
      GROUP BY s.team_id
    )
    SELECT
      t.id AS team_id,
      t.team_name,
      tr.name AS track_name,
      d.main_judges,
      d.risk_judges,
      d.problem_understanding,
      d.idea_feasibility,
      d.decision_making,
      d.coordination,
      d.risk_management,
      d.problem_understanding + d.idea_feasibility + d.decision_making
        + d.coordination AS main_total,
      d.risk_management AS risk_total,
      coalesce(
        d.problem_understanding + d.idea_feasibility + d.decision_making
          + d.coordination,
        0
      ) + coalesce(d.risk_management, 0) AS day_total,
      (d.main_judges > 0 AND d.risk_judges > 0) AS complete
    FROM day d
    JOIN ${teams} t ON t.id = d.team_id
    LEFT JOIN ${tracks} tr ON tr.id = t.track_id
    WHERE t.status = 'accepted' AND t.payment_status = 'paid'
    ORDER BY complete DESC, day_total DESC, t.team_name ASC
  `);

  return rows.map((row) => ({
    teamId: row.team_id,
    teamName: row.team_name,
    trackName: row.track_name,
    mainJudges: row.main_judges,
    riskJudges: row.risk_judges,
    problemUnderstanding: row.problem_understanding,
    ideaFeasibility: row.idea_feasibility,
    decisionMaking: row.decision_making,
    coordination: row.coordination,
    riskManagement: row.risk_management,
    mainTotal: row.main_total,
    riskTotal: row.risk_total,
    dayTotal: row.day_total,
    complete: row.complete,
  }));
}

/**
 * The team leaderboard: every day a team was scored on, each /100, summed and
 * divided by the number of rounds, so the final is /100 and a day not played
 * counts as zero — a team judged only on Day 1 tops out at 50, and every Day 2
 * finalist ranks above it. The divisor is the round count rather than a
 * literal 2 so it cannot disagree with `evaluation_rounds`.
 *
 * A team with any incomplete day (one panel type in, the other not) is left
 * off entirely: its total would be a number nobody can stand behind.
 */
export async function getLeaderboard() {
  const { rows } = await db.execute<{
    team_id: string;
    team_name: string;
    track_name: string | null;
    days: Array<{ roundId: string; total: number }>;
    total: string;
  }>(sql`
    WITH day AS (
      SELECT
        s.team_id,
        s.round_id,
        avg(s.problem_understanding) + avg(s.idea_feasibility)
          + avg(s.decision_making) + avg(s.coordination) AS main_total,
        avg(s.risk_management) AS risk_total
      FROM ${scores} s
      GROUP BY s.team_id, s.round_id
    )
    SELECT
      t.id AS team_id,
      t.team_name,
      tr.name AS track_name,
      json_agg(
        json_build_object(
          'roundId', d.round_id,
          'total', d.main_total + d.risk_total
        )
      ) AS days,
      sum(d.main_total + d.risk_total)
        / (SELECT count(*) FROM ${evaluationRounds}) AS total
    FROM day d
    JOIN ${teams} t ON t.id = d.team_id
    LEFT JOIN ${tracks} tr ON tr.id = t.track_id
    WHERE t.status = 'accepted' AND t.payment_status = 'paid'
    GROUP BY t.id, t.team_name, tr.name
    HAVING bool_and(d.main_total IS NOT NULL AND d.risk_total IS NOT NULL)
    ORDER BY total DESC, t.team_name ASC
  `);

  return rows.map((row) => ({
    teamId: row.team_id,
    teamName: row.team_name,
    trackName: row.track_name,
    days: row.days,
    total: row.total,
  }));
}

export async function getPanelForAdmin(
  adminId: string,
): Promise<{ id: string; name: string; type: PanelType } | null> {
  const [row] = await db
    .select({ id: panels.id, name: panels.name, type: panels.type })
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
 * `panelType` picks which of a team's two assignments is joined, so a team
 * appears once. Scores are that type's only when scoped to a panel; the
 * unscoped view returns both types, and each row says which it is.
 *
 * Ordered by team name A-Z and never filtered by whether a judge has scored
 * yet, so prev/next stays put under someone's hand as they save.
 */
export async function getPanelQueue(input: {
  roundId: string;
  panelId: string | null;
  panelType: PanelType;
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
        eq(teamPanelAssignments.panelType, input.panelType),
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
  // sheet. A team has one panel of each type per round, so filtering on the
  // type gives that panel's judges without having to filter on the roster.
  const scoreRows = await db
    .select({
      teamId: scores.teamId,
      evaluatorId: scores.evaluatorId,
      evaluatorName: admins.name,
      panelType: scores.panelType,
      problemUnderstanding: scores.problemUnderstanding,
      ideaFeasibility: scores.ideaFeasibility,
      decisionMaking: scores.decisionMaking,
      coordination: scores.coordination,
      riskManagement: scores.riskManagement,
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
        input.panelId ? eq(scores.panelType, input.panelType) : undefined,
      ),
    )
    .orderBy(asc(admins.name));

  return { teams: teamRows, scores: scoreRows };
}

type PanelQueueScore = {
  teamId: string;
  evaluatorId: string;
  evaluatorName: string;
  panelType: PanelType;
  problemUnderstanding: string | null;
  ideaFeasibility: string | null;
  decisionMaking: string | null;
  coordination: string | null;
  riskManagement: string | null;
  score: string | null;
  remarks: string | null;
};

/** Panels with how many teams each holds in a round — the panel switcher. */
export async function getPanelCounts(roundId: string) {
  return db
    .select({
      id: panels.id,
      name: panels.name,
      type: panels.type,
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
    .groupBy(panels.id, panels.name, panels.type)
    .orderBy(asc(panels.type), asc(panels.name));
}

/** Every panel with its judges and how many teams it holds in a round. */
export async function getPanelsWithJudges() {
  const panelRows = await db
    .select({ id: panels.id, name: panels.name, type: panels.type })
    .from(panels)
    .orderBy(asc(panels.type), asc(panels.name));

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
      panelType: teamPanelAssignments.panelType,
    })
    .from(teamPanelAssignments)
    .where(eq(teamPanelAssignments.roundId, roundId));
}

/**
 * The volunteers' "which room is this team in" list for one round: every team
 * with its Type 1 (`main`) panel and its progress mark for the round. Accepted, paid teams with no Type 1 panel
 * yet come back with `panelName: null`, so a gap shows as "Not assigned"
 * instead of the team being missing from the list.
 */
export async function getTeamPanelDirectory(roundId: string) {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.teamName,
      trackName: tracks.name,
      panelId: panels.id,
      panelName: panels.name,
      // No progress row yet means the team has not been started.
      status: sql<TeamProgress>`coalesce(${teamRoundProgress.status}, 'todo')`,
    })
    .from(teams)
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .leftJoin(
      teamPanelAssignments,
      and(
        eq(teamPanelAssignments.teamId, teams.id),
        eq(teamPanelAssignments.roundId, roundId),
        eq(teamPanelAssignments.panelType, "main"),
      ),
    )
    .leftJoin(panels, eq(teamPanelAssignments.panelId, panels.id))
    .leftJoin(
      teamRoundProgress,
      and(
        eq(teamRoundProgress.teamId, teams.id),
        eq(teamRoundProgress.roundId, roundId),
      ),
    )
    .where(
      or(
        isNotNull(teamPanelAssignments.id),
        and(eq(teams.status, "accepted"), eq(teams.paymentStatus, "paid")),
      ),
    )
    .orderBy(asc(teams.teamName));
}

export async function getEventConfig() {
  const [config] = await db
    .select()
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  return config ?? null;
}

/**
 * The teams through to Day 2: the top `DAY_TWO_QUALIFIERS` day totals of the
 * round that ran on `day_one`, plus anyone tied with the last of them. Ranks
 * every scored team whether or not both panel types are in, because Day 1 ran
 * with no Type 2 panel at all, so no team there is ever `complete`. A team
 * nobody scored does not qualify. Live, so a Day 1 score edited later moves
 * the line.
 */
export async function getDayTwoQualifiers(dayOne: string) {
  const [round] = await db
    .select({ id: evaluationRounds.id })
    .from(evaluationRounds)
    .where(eq(evaluationRounds.eventDate, dayOne))
    .limit(1);
  if (!round) return new Set<string>();

  const ranked = (await getPanelLeaderboardRows(round.id)).sort(
    (a, b) => Number(b.dayTotal) - Number(a.dayTotal),
  );
  const last = ranked[DAY_TWO_QUALIFIERS - 1];
  const cutoff = last ? Number(last.dayTotal) : Number.NEGATIVE_INFINITY;
  return new Set(
    ranked
      .filter((row) => Number(row.dayTotal) >= cutoff)
      .map((row) => row.teamId),
  );
}

/**
 * Which teams may be put in front of a panel for this round: the Day 2
 * qualifiers for the round that runs on `day_two`, or `null` (no gate) for
 * any other round. Same line as the door scanner, so a team can't be given a
 * panel it will never be let in to see.
 */
export async function getRoundQualifiers(roundId: string) {
  const [[round], config] = await Promise.all([
    db
      .select({ eventDate: evaluationRounds.eventDate })
      .from(evaluationRounds)
      .where(eq(evaluationRounds.id, roundId))
      .limit(1),
    getEventConfig(),
  ]);
  if (!round || !config || round.eventDate !== config.dayTwo) return null;
  return getDayTwoQualifiers(config.dayOne);
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

export async function findTeamByAttendanceCode(attendanceCode: string) {
  const [team] = await db
    .select({
      id: teams.id,
      teamName: teams.teamName,
      paymentStatus: teams.paymentStatus,
      paymentId: teams.paymentId,
      trackName: tracks.name,
    })
    .from(teams)
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .where(eq(teams.attendanceCode, attendanceCode))
    .limit(1);
  return team ?? null;
}

/**
 * Every member of a team with their attendance for one event day, leader
 * first. `scannedByName` is null both when nobody has marked the member and
 * when the volunteer who did has since been removed from `admins`.
 */
export async function getTeamAttendanceRoster(
  teamId: string,
  eventDate: string,
) {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      raNumber: members.raNumber,
      isLeader: members.isLeader,
      scannedAt: attendance.scannedAt,
      scannedByName: admins.name,
    })
    .from(members)
    .leftJoin(
      attendance,
      and(
        eq(attendance.memberId, members.id),
        eq(attendance.eventDate, eventDate),
      ),
    )
    .leftJoin(admins, eq(attendance.scannedBy, admins.id))
    .where(eq(members.teamId, teamId))
    .orderBy(desc(members.isLeader), asc(members.name));

  return rows.map((row) => ({ ...row, present: row.scannedAt !== null }));
}
