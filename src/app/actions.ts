"use server";

import { and, count, eq, inArray, or, sql } from "drizzle-orm";
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
import {
  type RegistrationValues,
  registrationSchema,
  toRoster,
} from "@/lib/validation/registration";

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
  return db
    .select()
    .from(tracks)
    .where(eq(tracks.isActive, true))
    .orderBy(tracks.name);
}

export type RegistrationFieldError = { path: string; message: string };

export type CreateTeamResult =
  | { ok: true; teamId: string }
  | { ok: false; formError?: string; fieldErrors: RegistrationFieldError[] };

/**
 * Constraint name behind a unique violation, or null.
 *
 * Two traps here, both verified against the live DB:
 *  - Drizzle wraps driver errors, so the pg error sits on `.cause`, not on the
 *    thrown `DrizzleQueryError`.
 *  - `instanceof DatabaseError` is `false` even for a genuine `DatabaseError`,
 *    because the class reachable from the package entry point is not the one
 *    the driver constructs. Duck-type on `code` instead.
 */
function uniqueViolationConstraint(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (candidate.code === "23505") {
      return typeof candidate.constraint === "string"
        ? candidate.constraint
        : null;
    }
    current = candidate.cause;
  }
  return null;
}

/** Roster index -> RHF path. Index 0 is always the leader. */
function rosterPath(index: number, field: string) {
  return index === 0 ? `leader.${field}` : `members.${index - 1}.${field}`;
}

export async function createTeam(
  values: RegistrationValues,
): Promise<CreateTeamResult> {
  const user = await requireLead();

  // Returned, not thrown: Next redacts thrown Server Action errors in
  // production, so a thrown "Registration has closed" would reach the user as
  // a generic "An error occurred". Only faults the user cannot act on stay as
  // throws.
  try {
    await assertBefore("registrationDeadline");
  } catch {
    return {
      ok: false,
      formError: "Registration is closed.",
      fieldErrors: [],
    };
  }

  // The client validates with this same schema, but the client is not a trust
  // boundary — a server action is a public HTTP endpoint.
  const parsed = registrationSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const roster = toRoster(parsed.data);
  if (roster.length < MIN_MEMBERS || roster.length > MAX_MEMBERS) {
    throw new Error(`Team must contain ${MIN_MEMBERS}-${MAX_MEMBERS} members`);
  }

  const existingTeam = await getTeamFor(user.id);
  if (existingTeam) {
    return {
      ok: false,
      formError: "You already have a team.",
      fieldErrors: [],
    };
  }

  const { teamName, trackId } = parsed.data.team;

  const [track] = await db
    .select()
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  if (!track || !track.isActive) {
    return {
      ok: false,
      fieldErrors: [
        { path: "team.trackId", message: "That track is no longer available." },
      ],
    };
  }

  // Every department code must exist — it is an FK, and a stale option in the
  // client's select would otherwise surface as a foreign-key error.
  const codes = [...new Set(roster.map((member) => member.departmentCode))];
  const known = await db
    .select({ code: departments.code })
    .from(departments)
    .where(inArray(departments.code, codes));
  const knownCodes = new Set(known.map((row) => row.code));
  const badDepartments = roster.flatMap((member, index) =>
    knownCodes.has(member.departmentCode)
      ? []
      : [
          {
            path: rosterPath(index, "departmentCode"),
            message: "Pick a department from the list.",
          },
        ],
  );
  if (badDepartments.length) {
    return { ok: false, fieldErrors: badDepartments };
  }

  let team: Awaited<ReturnType<typeof registerTeamWithMembers>>;
  try {
    team = await registerTeamWithMembers({
      teamName,
      trackId,
      leaderUserId: user.id,
      members: roster,
    });
  } catch (error) {
    const fieldErrors = await translateRegistrationConflict(error, roster);
    if (fieldErrors) return fieldErrors;
    throw error;
  }

  await log(user.id, "team.create", "team", team.team.id, { trackId });
  revalidatePath("/dashboard");
  revalidatePath("/register");
  return { ok: true, teamId: team.team.id };
}

/**
 * Turns a unique-constraint violation into per-field messages the form can
 * attach. The constraint name says *which column* collided but not which
 * member row, so one lookup finds the offending values and maps them back to
 * roster positions.
 */
async function translateRegistrationConflict(
  error: unknown,
  roster: MemberInput[],
): Promise<{
  ok: false;
  formError?: string;
  fieldErrors: RegistrationFieldError[];
} | null> {
  const constraint = uniqueViolationConstraint(error);
  if (!constraint) return null;

  // Matched by substring, not equality: the applied migration declares these
  // inline so Postgres named them `<table>_<column>_key`, while a future
  // `drizzle-kit generate` from schema.ts would name them `..._unique`.
  // Substring matching survives both.
  if (constraint.includes("team_name")) {
    return {
      ok: false,
      fieldErrors: [
        {
          path: "team.teamName",
          message: "That team name is taken. Pick another.",
        },
      ],
    };
  }

  if (constraint.includes("lead_user_id")) {
    return {
      ok: false,
      formError: "You already have a team.",
      fieldErrors: [],
    };
  }

  if (constraint.includes("ra_number") || constraint.includes("net_id")) {
    const taken = await db
      .select({ raNumber: members.raNumber, netId: members.netId })
      .from(members)
      .where(
        or(
          inArray(
            members.raNumber,
            roster.map((member) => member.raNumber),
          ),
          inArray(
            members.netId,
            roster.map((member) => member.netId),
          ),
        ),
      );

    const takenRa = new Set(taken.map((row) => row.raNumber));
    const takenNetId = new Set(taken.map((row) => row.netId));

    const fieldErrors = roster.flatMap((member, index) => [
      ...(takenRa.has(member.raNumber)
        ? [
            {
              path: rosterPath(index, "raNumber"),
              message: "This RA number is already registered.",
            },
          ]
        : []),
      ...(takenNetId.has(member.netId)
        ? [
            {
              path: rosterPath(index, "netId"),
              message: "This netID is already registered.",
            },
          ]
        : []),
    ]);

    return {
      ok: false,
      formError: fieldErrors.length
        ? undefined
        : "Someone in your team is already registered.",
      fieldErrors,
    };
  }

  return null;
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

export async function getMyTeam() {
  const user = await requireLead();
  return getTeamFor(user.id);
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
    .where(eq(members.attendanceCode, attendanceCode.trim()))
    .limit(1);

  if (!member) throw new Error("Invalid attendance code");

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, member.teamId))
    .limit(1);

  if (!team) throw new Error("Team not found for member");

  const [row] = await db
    .insert(attendance)
    .values({
      memberId: member.id,
      eventDate: dateValue,
      scannedBy: admin.id,
    })
    .onConflictDoNothing({
      target: [attendance.memberId, attendance.eventDate],
    })
    .returning();

  return {
    member,
    team,
    alreadyPresent: !row,
    attendance: row ?? null,
  };
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

export async function getAdminReviewData() {
  const admin = await requireAdminRole([
    "super_admin",
    "evaluator",
    "volunteer",
  ]);

  const [teamRows, roundRows, submissionRows, memberRows, scoreRows] =
    await Promise.all([
      db
        .select({
          id: teams.id,
          teamName: teams.teamName,
          trackId: teams.trackId,
          trackName: tracks.name,
          status: teams.status,
          paymentStatus: teams.paymentStatus,
          createdAt: teams.createdAt,
        })
        .from(teams)
        .leftJoin(tracks, eq(teams.trackId, tracks.id))
        .orderBy(teams.createdAt),
      db
        .select({
          id: evaluationRounds.id,
          name: evaluationRounds.name,
          description: evaluationRounds.description,
          sequenceNo: evaluationRounds.sequenceNo,
          isActive: evaluationRounds.isActive,
        })
        .from(evaluationRounds)
        .orderBy(evaluationRounds.sequenceNo),
      db
        .select({
          id: submissions.id,
          teamId: submissions.teamId,
          roundId: submissions.roundId,
          title: submissions.title,
          description: submissions.description,
          driveLink: submissions.driveLink,
          status: submissions.status,
          remarks: submissions.remarks,
          submittedAt: submissions.submittedAt,
        })
        .from(submissions)
        .orderBy(submissions.updatedAt),
      db
        .select({
          id: members.id,
          teamId: members.teamId,
          name: members.name,
          raNumber: members.raNumber,
          netId: members.netId,
          isLeader: members.isLeader,
        })
        .from(members)
        .orderBy(members.createdAt),
      db
        .select({
          id: scores.id,
          teamId: scores.teamId,
          roundId: scores.roundId,
          evaluatorId: scores.evaluatorId,
          score: scores.score,
          remarks: scores.remarks,
        })
        .from(scores),
    ]);

  return {
    admin: { id: admin.id, name: admin.name, role: admin.role },
    teams: teamRows,
    rounds: roundRows,
    submissions: submissionRows,
    members: memberRows,
    scores: scoreRows,
  };
}
