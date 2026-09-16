"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  admins,
  announcements,
  attendance,
  departments,
  evaluationRounds,
  eventConfig,
  members,
  scores,
  submissions,
  teams,
  tracks,
} from "@/db/schema";
import {
  addMemberAtomically,
  createPaymentRecord,
  registerTeamWithMembers,
  removeMemberAtomically,
} from "@/db/transactions";
import { auth } from "@/lib/auth/server";
import { getAdminActor, requireAdminRole } from "@/lib/roles";

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 4;

type MemberInput = {
  name: string;
  raNumber: string;
  netId: string;
  phoneNumber: string;
  departmentCode: string;
  facultyName: string;
  facultyPhone: string;
  facultyEmail: string;
  isLeader?: boolean;
};

async function requireLead() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id || !session.user.email)
    throw new Error("Not signed in");
  return session.user;
}

async function getTeamFor(leadUserId: string) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.leadUserId, leadUserId))
    .limit(1);
  return team ?? null;
}

async function assertBefore(
  field: "registrationDeadline" | "submissionDeadline",
) {
  const [cfg] = await db
    .select()
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  if (!cfg) throw new Error("Event configuration is not initialized");
  if (Date.now() > cfg[field].getTime()) throw new Error("Deadline passed");
}

async function log(
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: unknown,
) {
  const { auditLog } = await import("@/db/schema");
  await db.insert(auditLog).values({
    actorUserId,
    action,
    targetType,
    targetId,
    meta: meta ? JSON.stringify(meta) : null,
  });
}

export async function getDepartments() {
  return db.select().from(departments).orderBy(departments.label);
}

export async function getTracks() {
  return db.select().from(tracks).where(eq(tracks.isActive, true));
}

export async function createTeam(
  name: string,
  trackId: string,
  membersInput: MemberInput[],
) {
  const user = await requireLead();
  await assertBefore("registrationDeadline");

  if (!name.trim()) throw new Error("Team name is required");
  if (membersInput.length < MIN_MEMBERS || membersInput.length > MAX_MEMBERS) {
    throw new Error(`Team must contain ${MIN_MEMBERS}-${MAX_MEMBERS} members`);
  }

  const leaders = membersInput.filter((member) => member.isLeader);
  if (leaders.length !== 1) throw new Error("Exactly one leader is required");

  const existingTeam = await getTeamFor(user.id);
  if (existingTeam) throw new Error("You already have a team");

  const [track] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  if (!track || !track.isActive) throw new Error("Invalid or inactive track");

  const team = await registerTeamWithMembers({
    teamName: name.trim(),
    trackId,
    leaderUserId: user.id,
    members: membersInput.map((member) => ({ ...member })),
  });

  await log(user.id, "team.create", "team", team.team.id, { trackId });
  revalidatePath("/dashboard");
  return team.team;
}

export async function addMember(input: MemberInput) {
  const user = await requireLead();
  await assertBefore("registrationDeadline");
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");

  const member = await addMemberAtomically(team.id, input);
  await log(user.id, "team.member.add", "team", team.id, {
    memberId: member.id,
  });
  revalidatePath("/dashboard");
  return member;
}

export async function removeMember(memberId: string) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("No team");
  await assertBefore("registrationDeadline");

  const member = await removeMemberAtomically(team.id, memberId);
  await log(user.id, "team.member.remove", "team", team.id, {
    memberId: member.id,
  });
  revalidatePath("/dashboard");
}

export async function setTrack(trackId: string) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");
  await assertBefore("registrationDeadline");

  const [activeRound] = await db
    .select()
    .from(evaluationRounds)
    .where(eq(evaluationRounds.isActive, true))
    .limit(1);

  if (activeRound) {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.teamId, team.id),
          eq(submissions.roundId, activeRound.id),
        ),
      )
      .limit(1);

    if (submission && submission.status !== "pending_submission") {
      throw new Error(
        "Track cannot be changed after submission review has started",
      );
    }
  }

  const [track] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.id, trackId), eq(tracks.isActive, true)))
    .limit(1);
  if (!track) throw new Error("Invalid or inactive track");

  await db
    .update(teams)
    .set({ trackId, updatedAt: new Date() })
    .where(eq(teams.id, team.id));
  revalidatePath("/dashboard");
}

export async function submitSubmission(
  roundId: string,
  title: string,
  description: string,
  driveLink: string,
) {
  const user = await requireLead();
  await assertBefore("submissionDeadline");
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");

  const [round] = await db
    .select()
    .from(evaluationRounds)
    .where(eq(evaluationRounds.id, roundId))
    .limit(1);
  if (!round) throw new Error("Evaluation round not found");
  if (!round.isActive) throw new Error("This evaluation round is not active");

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(members)
    .where(eq(members.teamId, team.id));

  if (memberCount < MIN_MEMBERS) {
    throw new Error("At least 2 members are required to submit");
  }

  const [existing] = await db
    .select()
    .from(submissions)
    .where(
      and(eq(submissions.teamId, team.id), eq(submissions.roundId, roundId)),
    )
    .limit(1);

  if (existing?.status === "in_review" || existing?.status === "accepted") {
    throw new Error("Submission cannot be resubmitted in its current state");
  }

  const submissionValues = {
    title: title.trim() || null,
    description: description.trim() || null,
    driveLink: driveLink.trim(),
    status: "in_review" as const,
    submittedAt: new Date(),
    updatedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    remarks: null,
  };

  const [submission] = existing
    ? await db
        .update(submissions)
        .set(submissionValues)
        .where(eq(submissions.id, existing.id))
        .returning()
    : await db
        .insert(submissions)
        .values({
          teamId: team.id,
          roundId,
          ...submissionValues,
        })
        .returning();

  if (!submission) throw new Error("Failed to save submission");

  await log(user.id, "submission.submit", "submission", submission.id, {
    roundId,
  });
  revalidatePath("/dashboard");
  return submission;
}

export async function getMyDashboard() {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) return null;
  const [teamMembers, teamSubmissions] = await Promise.all([
    db.select().from(members).where(eq(members.teamId, team.id)),
    db.select().from(submissions).where(eq(submissions.teamId, team.id)),
  ]);
  return { team, members: teamMembers, submissions: teamSubmissions };
}

export async function createPaymentOrderRecord(razorpayOrderId: string) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");

  const [submission] = await db
    .select()
    .from(submissions)
    .where(
      and(eq(submissions.teamId, team.id), eq(submissions.status, "accepted")),
    )
    .limit(1);
  if (!submission) {
    throw new Error("Payment is available only after acceptance");
  }

  const [cfg] = await db
    .select()
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  if (!cfg) throw new Error("Event configuration is not initialized");

  const payment = await createPaymentRecord({
    teamId: team.id,
    razorpayOrderId,
    amount: String(cfg.registrationFee),
  });

  await log(user.id, "payment.order.create", "payment", payment.id);
  revalidatePath("/dashboard");
  return payment;
}

export async function addAdmin(
  email: string,
  name: string,
  role: "super_admin" | "evaluator" | "volunteer",
) {
  await requireAdminRole(["super_admin"]);
  const [admin] = await db
    .insert(admins)
    .values({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
    })
    .returning();
  return admin;
}

export async function listAdmins() {
  await requireAdminRole(["super_admin"]);
  return db
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .orderBy(admins.createdAt);
}

export async function updateEventConfig(input: {
  registrationDeadline: Date;
  submissionDeadline: Date;
  registrationFee: string;
}) {
  const admin = await requireAdminRole(["super_admin"]);
  if (input.registrationDeadline > input.submissionDeadline) {
    throw new Error(
      "Registration deadline cannot be after submission deadline",
    );
  }
  const [config] = await db
    .update(eventConfig)
    .set({
      registrationDeadline: input.registrationDeadline,
      submissionDeadline: input.submissionDeadline,
      registrationFee: input.registrationFee,
      updatedAt: new Date(),
    })
    .where(eq(eventConfig.id, 1))
    .returning();
  if (!config) throw new Error("Event configuration is not initialized");
  await log(admin.id, "config.update", "event_config", "1");
  revalidatePath("/admin");
  return config;
}

export async function createEvaluationRound(
  name: string,
  description: string | undefined,
  sequenceNo: number,
) {
  const admin = await requireAdminRole(["super_admin"]);
  if (!Number.isInteger(sequenceNo) || sequenceNo < 1)
    throw new Error("Invalid sequence number");
  const [round] = await db
    .insert(evaluationRounds)
    .values({
      name: name.trim(),
      description: description?.trim() || null,
      sequenceNo,
    })
    .returning();
  await log(admin.id, "round.create", "round", round.id, { sequenceNo });
  revalidatePath("/admin");
  return round;
}

export async function setActiveEvaluationRound(
  roundId: string,
  isActive: boolean,
) {
  const admin = await requireAdminRole(["super_admin"]);
  const [round] = await db
    .select()
    .from(evaluationRounds)
    .where(eq(evaluationRounds.id, roundId))
    .limit(1);
  if (!round) throw new Error("Round not found");

  await db.transaction(async (tx) => {
    if (isActive) {
      await tx
        .update(evaluationRounds)
        .set({ isActive: false })
        .where(eq(evaluationRounds.isActive, true));
    }
    await tx
      .update(evaluationRounds)
      .set({ isActive })
      .where(eq(evaluationRounds.id, roundId));
  });

  await log(admin.id, "round.activate", "round", roundId, { isActive });
  revalidatePath("/admin");
  revalidatePath("/dashboard/leaderboard");
}

export async function createAnnouncement(title: string, body: string) {
  const admin = await requireAdminRole(["super_admin", "volunteer"]);
  const [announcement] = await db
    .insert(announcements)
    .values({
      title: title.trim(),
      body: body.trim(),
    })
    .returning();
  await log(admin.id, "announcement.create", "announcement", announcement.id);
  revalidatePath("/");
  return announcement;
}

export async function reviewSubmission(
  submissionId: string,
  status: "accepted" | "rejected",
  remarks?: string,
) {
  const admin = await requireAdminRole(["super_admin"]);
  const [submission] = await db
    .update(submissions)
    .set({
      status,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      remarks: remarks?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId))
    .returning();
  if (!submission) throw new Error("Submission not found");
  await log(admin.id, `submission.${status}`, "submission", submissionId, {
    remarks,
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return submission;
}

export async function setTeamStatus(
  teamId: string,
  status: "pending" | "approved" | "rejected",
) {
  const admin = await requireAdminRole(["super_admin"]);
  const [team] = await db
    .update(teams)
    .set({
      status,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
    .returning();
  if (!team) throw new Error("Team not found");
  await log(admin.id, `team.${status}`, "team", teamId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return team;
}

export async function upsertScore(
  roundId: string,
  teamId: string,
  score: number,
  remarks?: string,
) {
  const admin = await requireAdminRole(["evaluator", "super_admin"]);
  if (!Number.isFinite(score) || score < 0 || score > 100)
    throw new Error("Score must be between 0 and 100");

  const [row] = await db
    .insert(scores)
    .values({
      teamId,
      roundId,
      evaluatorId: admin.id,
      score: score.toFixed(2),
      remarks: remarks?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [scores.teamId, scores.roundId, scores.evaluatorId],
      set: { score: score.toFixed(2), remarks: remarks?.trim() || null },
    })
    .returning();

  await log(admin.id, "score.upsert", "team", teamId, { roundId, score });
  revalidatePath("/dashboard/leaderboard");
  return row;
}

export async function scanAttendance(
  attendanceCode: string,
  eventDate?: string,
) {
  const admin = await requireAdminRole(["volunteer", "super_admin"]);
  const dateValue = eventDate ?? new Date().toISOString().slice(0, 10);

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.attendanceCode, attendanceCode))
    .limit(1);
  if (!member) throw new Error("Invalid attendance code");

  const [row] = await db
    .insert(attendance)
    .values({ memberId: member.id, eventDate: dateValue, scannedBy: admin.id })
    .onConflictDoNothing({
      target: [attendance.memberId, attendance.eventDate],
    })
    .returning();

  return { memberId: member.id, alreadyPresent: !row, attendance: row ?? null };
}

export async function publishResults(enabled: boolean) {
  const admin = await requireAdminRole(["super_admin"]);
  await db
    .update(eventConfig)
    .set({ resultsPublished: enabled, updatedAt: new Date() })
    .where(eq(eventConfig.id, 1));
  await log(admin.id, "results.publish", "event_config", "1", { enabled });
  revalidatePath("/dashboard/leaderboard");
}

export async function getAdminAnnouncements() {
  return db
    .select()
    .from(announcements)
    .orderBy(sql`${announcements.createdAt} desc`);
}

export async function getCurrentAdmin() {
  return getAdminActor();
}
