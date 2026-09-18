import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "./index";
import {
  attendance,
  departments,
  evaluationRounds,
  eventConfig,
  members,
  scores,
  submissions,
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

export async function getLeaderboard() {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.teamName,
      trackName: tracks.name,
      totalScore: sql<string>`coalesce(sum(${scores.score}), 0)`,
      averageScore: sql<string>`coalesce(avg(${scores.score}), 0)`,
    })
    .from(scores)
    .innerJoin(teams, eq(scores.teamId, teams.id))
    .leftJoin(tracks, eq(teams.trackId, tracks.id))
    .where(and(eq(teams.paymentStatus, "paid"), eq(teams.status, "accepted")))
    .groupBy(teams.id, teams.teamName, tracks.name)
    .orderBy(desc(sql`coalesce(avg(${scores.score}), 0)`));
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
