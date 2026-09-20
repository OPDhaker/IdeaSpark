"use server";

import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getLeaderboard } from "@/db/queries";
import {
  admins,
  announcements,
  attendance,
  departments,
  evaluationRounds,
  eventConfig,
  members,
  payments,
  scores,
  submissions,
  teams,
  tracks,
} from "@/db/schema";
import {
  addMemberAtomically,
  createPaymentRecord,
  overrideTeamStatusAtomically,
  type ReviewStatus,
  registerTeamWithMembers,
  removeMemberAtomically,
  reviewSubmissionAtomically,
  submitIdeaAtomically,
} from "@/db/transactions";
import { log } from "@/lib/audit";
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

/**
 * `YYYY-MM-DD` for "now" in Asia/Kolkata.
 *
 * Every `date` column here means a local calendar day, and the server runs in
 * UTC — comparing those directly would flip the day at 05:30 IST.
 */
function todayInIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  if (team.status !== "pending_submission") {
    throw new Error("Track cannot be changed after your idea is submitted");
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

  if (!driveLink.trim()) throw new Error("A submission link is required");

  // The status transition (submission + team, in one transaction) lives in the
  // transaction layer; the state guards are there too.
  const submission = await submitIdeaAtomically({
    teamId: team.id,
    roundId,
    title: title.trim() || null,
    description: description.trim() || null,
    driveLink: driveLink.trim(),
  });

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

/**
 * Everything the dashboard needs to render the current lifecycle step:
 * pending_submission (show the template + upload form), in_review, accepted
 * (show payment) or rejected (terminal, show remarks).
 *
 * One call, because all three cards on the page read from it — the constant
 * hero and track cards as much as the action card that swaps.
 */
export async function getSubmissionState() {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) return null;

  const [[cfg], [activeRound], [track], [{ value: memberCount }]] =
    await Promise.all([
      db.select().from(eventConfig).where(eq(eventConfig.id, 1)).limit(1),
      db
        .select()
        .from(evaluationRounds)
        .where(eq(evaluationRounds.isActive, true))
        .limit(1),
      team.trackId
        ? db
            .select({ name: tracks.name, description: tracks.description })
            .from(tracks)
            .where(eq(tracks.id, team.trackId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ value: count() })
        .from(members)
        .where(eq(members.teamId, team.id)),
    ]);

  const [submission] = activeRound
    ? await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.teamId, team.id),
            eq(submissions.roundId, activeRound.id),
          ),
        )
        .limit(1)
    : [];

  return {
    teamId: team.id,
    teamName: team.teamName,
    teamStatus: team.status,
    paymentStatus: team.paymentStatus,
    trackName: track?.name ?? null,
    trackDescription: track?.description ?? null,
    memberCount,
    activeRound: activeRound ?? null,
    submission: submission ?? null,
    templateUrl: cfg?.submissionTemplateUrl ?? null,
    submissionDeadline: cfg?.submissionDeadline ?? null,
    registrationFee: cfg?.registrationFee ?? null,
  };
}

/**
 * Whether the leaderboard is open yet, plus the date it opens.
 *
 * Compared in IST — `day_one` is a calendar day, and against UTC `now()` the
 * board would appear half a day early.
 */
export async function getLeaderboardVisibility() {
  const [cfg] = await db
    .select({ dayOne: eventConfig.dayOne })
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);

  if (!cfg) return { visible: false, dayOne: null };
  return { visible: todayInIst() >= cfg.dayOne, dayOne: cfg.dayOne };
}

/**
 * The one read the dashboard shell needs: who is signed in, and whether the
 * leaderboard nav item should exist. Done once in the layout so the three
 * pages underneath don't each repeat it.
 */
export async function getDashboardShell() {
  const user = await requireLead();
  const { visible, dayOne } = await getLeaderboardVisibility();
  return {
    userName: user.name ?? null,
    userEmail: user.email ?? null,
    leaderboardVisible: visible,
    leaderboardOpensOn: dayOne,
  };
}

/**
 * The roster, with department labels resolved — the UI shows "Computer
 * Science", not the `CSE01` foreign key.
 */
export async function getTeamRoster() {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) return null;

  const [roster, [track]] = await Promise.all([
    db
      .select({
        id: members.id,
        name: members.name,
        raNumber: members.raNumber,
        netId: members.netId,
        phoneNumber: members.phoneNumber,
        departmentCode: members.departmentCode,
        departmentLabel: departments.label,
        facultyName: members.facultyName,
        facultyPhone: members.facultyPhone,
        facultyEmail: members.facultyEmail,
        isLeader: members.isLeader,
      })
      .from(members)
      .leftJoin(departments, eq(members.departmentCode, departments.code))
      .where(eq(members.teamId, team.id))
      .orderBy(sql`${members.isLeader} desc`, members.name),
    team.trackId
      ? db
          .select({ name: tracks.name })
          .from(tracks)
          .where(eq(tracks.id, team.trackId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    team,
    trackName: track?.name ?? null,
    members: roster,
    rosterLocked: team.paymentStatus === "paid",
  };
}

/**
 * Everything on the printable pass strip. Returns null unless the team has
 * actually paid, so the route guard and the data fetch cannot disagree.
 *
 * One pass per member: `attendance_code` is minted per member on payment and
 * only the leader has a login, so the leader hands the passes out.
 */
export async function getReceipt() {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team || team.paymentStatus !== "paid") return null;

  const [[payment], passes, [track]] = await Promise.all([
    db.select().from(payments).where(eq(payments.teamId, team.id)).limit(1),
    db
      .select({
        id: members.id,
        name: members.name,
        raNumber: members.raNumber,
        isLeader: members.isLeader,
        attendanceCode: members.attendanceCode,
      })
      .from(members)
      .where(eq(members.teamId, team.id))
      .orderBy(sql`${members.isLeader} desc`, members.name),
    team.trackId
      ? db
          .select({ name: tracks.name })
          .from(tracks)
          .where(eq(tracks.id, team.trackId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const [cfg] = await db
    .select({ dayOne: eventConfig.dayOne, dayTwo: eventConfig.dayTwo })
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);

  return {
    team,
    trackName: track?.name ?? null,
    payment: payment ?? null,
    members: passes,
    dayOne: cfg?.dayOne ?? null,
    dayTwo: cfg?.dayTwo ?? null,
  };
}

/**
 * The leaderboard, gated on day one. The gate lives here rather than only in
 * the nav so that guessing the URL hits the same refusal.
 *
 * `getLeaderboard()` inner-joins `scores`, so a team nobody has scored yet is
 * absent from the list rather than ranked last — an empty board is the normal
 * state until judging starts.
 */
export async function getLeaderboardView() {
  const user = await requireLead();
  const [team, { visible, dayOne }] = await Promise.all([
    getTeamFor(user.id),
    getLeaderboardVisibility(),
  ]);

  if (!visible) {
    return {
      visible: false as const,
      opensOn: dayOne,
      rows: [],
      myTeamId: null,
    };
  }

  const rows = await getLeaderboard();
  return {
    visible: true as const,
    opensOn: dayOne,
    rows,
    myTeamId: team?.id ?? null,
  };
}

export async function createPaymentOrderRecord(razorpayOrderId: string) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");

  // `teams.status` mirrors the submission verdict (written in the same
  // transaction), so the team row already in hand is the gate.
  if (team.status !== "accepted") {
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
  submissionTemplateUrl?: string | null;
  /** `YYYY-MM-DD`. Mirrors the `date` columns, so no timezone is implied. */
  dayOne?: string;
  dayTwo?: string;
}) {
  const admin = await requireAdminRole(["super_admin"]);
  if (input.registrationDeadline > input.submissionDeadline) {
    throw new Error(
      "Registration deadline cannot be after submission deadline",
    );
  }
  if (input.dayOne && input.dayTwo && input.dayOne > input.dayTwo) {
    throw new Error("Day one cannot be after day two");
  }
  const [config] = await db
    .update(eventConfig)
    .set({
      registrationDeadline: input.registrationDeadline,
      submissionDeadline: input.submissionDeadline,
      registrationFee: input.registrationFee,
      ...(input.dayOne === undefined ? {} : { dayOne: input.dayOne }),
      ...(input.dayTwo === undefined ? {} : { dayTwo: input.dayTwo }),
      ...(input.submissionTemplateUrl === undefined
        ? {}
        : {
            submissionTemplateUrl: input.submissionTemplateUrl?.trim() || null,
          }),
      updatedAt: new Date(),
    })
    .where(eq(eventConfig.id, 1))
    .returning();
  if (!config) throw new Error("Event configuration is not initialized");
  await log(admin.id, "config.update", "event_config", "1");
  revalidatePath("/admin");
  return config;
}

export async function createEvaluationRound(input: {
  name: string;
  description?: string;
  sequenceNo: number;
  slug: string;
  eventDate: string;
}) {
  const admin = await requireAdminRole(["super_admin"]);
  if (!Number.isInteger(input.sequenceNo) || input.sequenceNo < 1)
    throw new Error("Invalid sequence number");

  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new Error("Slug must be lowercase letters, numbers and dashes");

  // `event_date` decides which attendance rows make a team judgeable, so it has
  // to be one of the two configured days. A `check` cannot reach across to
  // `event_config`, so the constraint lives here — the same shape
  // `scanAttendance` uses to validate a scan date.
  const [cfg] = await db
    .select({ dayOne: eventConfig.dayOne, dayTwo: eventConfig.dayTwo })
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  if (!cfg) throw new Error("Event configuration is not initialized");
  if (input.eventDate !== cfg.dayOne && input.eventDate !== cfg.dayTwo)
    throw new Error(`A round must run on ${cfg.dayOne} or ${cfg.dayTwo}`);

  const [round] = await db
    .insert(evaluationRounds)
    .values({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sequenceNo: input.sequenceNo,
      slug,
      eventDate: input.eventDate,
    })
    .returning();
  await log(admin.id, "round.create", "round", round.id, {
    sequenceNo: input.sequenceNo,
    slug,
  });
  revalidatePath("/admin");
  revalidatePath("/panel", "layout");
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
  const { submission, team } = await reviewSubmissionAtomically({
    submissionId,
    status,
    adminId: admin.id,
    remarks,
  });
  await log(admin.id, `submission.${status}`, "submission", submissionId, {
    teamId: team.id,
    remarks,
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leaderboard");
  return submission;
}

/**
 * Manual override. The normal way a team changes state is the team submitting
 * (`submitSubmission`) and an admin deciding (`reviewSubmission`) — use this
 * only to correct a mistake or to reopen a team, which also clears the active
 * round's submission.
 */
export async function setTeamStatus(teamId: string, status: ReviewStatus) {
  const admin = await requireAdminRole(["super_admin"]);
  const team = await overrideTeamStatusAtomically({
    teamId,
    status,
    adminId: admin.id,
  });
  await log(admin.id, "team.status.override", "team", teamId, { status });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leaderboard");
  return team;
}

export async function scanAttendance(
  attendanceCode: string,
  eventDate?: string,
) {
  const admin = await requireAdminRole(["volunteer", "super_admin"]);

  // The date is part of a UNIQUE key, so an arbitrary string here would let a
  // volunteer mint a second "present" row for the same member on a day the
  // event does not run. Only the two configured days are accepted.
  const [cfg] = await db
    .select({ dayOne: eventConfig.dayOne, dayTwo: eventConfig.dayTwo })
    .from(eventConfig)
    .where(eq(eventConfig.id, 1))
    .limit(1);
  if (!cfg) throw new Error("Event configuration is not initialized");

  const dateValue = eventDate ?? todayInIst();
  if (dateValue !== cfg.dayOne && dateValue !== cfg.dayTwo) {
    throw new Error(
      `Attendance can only be marked on ${cfg.dayOne} or ${cfg.dayTwo}`,
    );
  }

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
