import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  evaluationRounds,
  members,
  panelMembers,
  panels,
  payments,
  scores,
  submissions,
  teamPanelAssignments,
  teams,
} from "./schema";

export type ReviewStatus =
  | "pending_submission"
  | "in_review"
  | "rejected"
  | "accepted";

export type RegistrationMember = {
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

export async function addMemberAtomically(
  teamId: string,
  input: RegistrationMember,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${teamId}))`);

    const [team] = await tx
      .select({ id: teams.id, paymentStatus: teams.paymentStatus })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update")
      .limit(1);

    if (!team) throw new Error("Team not found");
    if (team.paymentStatus === "paid")
      throw new Error("Roster is locked after payment");

    const [{ value: memberCount }] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.teamId, teamId));

    if (memberCount >= 4) throw new Error("Team is full (max 4 members)");

    if (input.isLeader) {
      const [leader] = await tx
        .select({ id: members.id })
        .from(members)
        .where(and(eq(members.teamId, teamId), eq(members.isLeader, true)))
        .limit(1);

      if (leader) throw new Error("Team already has a leader");
    }

    const [member] = await tx
      .insert(members)
      .values({
        name: input.name,
        raNumber: input.raNumber,
        netId: input.netId,
        phoneNumber: input.phoneNumber,
        departmentCode: input.departmentCode,
        facultyName: input.facultyName,
        facultyPhone: input.facultyPhone,
        facultyEmail: input.facultyEmail,
        teamId,
        isLeader: Boolean(input.isLeader),
        attendanceCode: null,
      })
      .returning();

    return member;
  });
}

export async function removeMemberAtomically(teamId: string, memberId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${teamId}))`);

    const [team] = await tx
      .select({ id: teams.id, paymentStatus: teams.paymentStatus })
      .from(teams)
      .where(eq(teams.id, teamId))
      .for("update")
      .limit(1);

    if (!team) throw new Error("Team not found");
    if (team.paymentStatus === "paid")
      throw new Error("Roster is locked after payment");

    const [member] = await tx
      .select({ id: members.id, isLeader: members.isLeader })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.teamId, teamId)))
      .limit(1);

    if (!member) throw new Error("Member not found");
    if (member.isLeader) throw new Error("The team leader cannot be removed");

    const [{ value: memberCount }] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.teamId, teamId));

    if (memberCount <= 2)
      throw new Error("A team must retain at least 2 members");

    await tx.delete(members).where(eq(members.id, memberId));
    return member;
  });
}

export async function registerTeamWithMembers(input: {
  teamName: string;
  trackId: string;
  leaderUserId: string;
  members: RegistrationMember[];
}) {
  return db.transaction(async (tx) => {
    if (input.members.length < 2 || input.members.length > 4) {
      throw new Error("A team must contain 2 to 4 members");
    }

    const leaders = input.members.filter((member) => member.isLeader);
    if (leaders.length !== 1) throw new Error("Exactly one leader is required");

    const [team] = await tx
      .insert(teams)
      .values({
        teamName: input.teamName,
        trackId: input.trackId,
        leadUserId: input.leaderUserId,
        status: "pending_submission",
      })
      .returning();

    const memberRows = input.members.map((member) => ({
      name: member.name,
      raNumber: member.raNumber,
      netId: member.netId,
      phoneNumber: member.phoneNumber,
      departmentCode: member.departmentCode,
      facultyName: member.facultyName,
      facultyPhone: member.facultyPhone,
      facultyEmail: member.facultyEmail,
      teamId: team.id,
      isLeader: Boolean(member.isLeader),
      attendanceCode: null,
    }));

    const createdMembers = await tx
      .insert(members)
      .values(memberRows)
      .returning();
    return { team, members: createdMembers };
  });
}

export async function createPaymentRecord(input: {
  teamId: string;
  razorpayOrderId: string;
  amount: string;
}) {
  return db.transaction(async (tx) => {
    const [team] = await tx
      .select({ id: teams.id, paymentStatus: teams.paymentStatus })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .for("update")
      .limit(1);

    if (!team) throw new Error("Team not found");
    if (team.paymentStatus === "paid") throw new Error("Team is already paid");

    const [existing] = await tx
      .select()
      .from(payments)
      .where(eq(payments.teamId, input.teamId))
      .limit(1);

    if (existing) {
      if (existing.status === "paid") throw new Error("Team is already paid");
      return existing;
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        teamId: input.teamId,
        razorpayOrderId: input.razorpayOrderId,
        amount: input.amount,
        status: "created",
      })
      .returning();

    return payment;
  });
}

/**
 * Finalizes a verified payment and locks the roster.
 * Attendance codes are minted in one SQL UPDATE, not a per-member loop.
 */
export async function markPaymentPaidAtomically(input: {
  teamId: string;
  paymentId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paidAt?: Date;
}) {
  return db.transaction(async (tx) => {
    const [team] = await tx
      .select({ id: teams.id, paymentStatus: teams.paymentStatus })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .for("update")
      .limit(1);

    if (!team) throw new Error("Team not found");

    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, input.paymentId),
          eq(payments.teamId, input.teamId),
        ),
      )
      .for("update")
      .limit(1);

    if (!payment) throw new Error("Payment not found");
    if (payment.status === "paid") return payment;

    const [updatedPayment] = await tx
      .update(payments)
      .set({
        status: "paid",
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        paidAt: input.paidAt ?? new Date(),
      })
      .where(
        and(
          eq(payments.id, input.paymentId),
          eq(payments.teamId, input.teamId),
        ),
      )
      .returning();

    if (!updatedPayment) throw new Error("Failed to finalize payment");

    await tx
      .update(teams)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(teams.id, input.teamId));

    await tx.execute(sql`
      UPDATE members
      SET attendance_code = gen_random_uuid()::text
      WHERE team_id = ${input.teamId}
        AND attendance_code IS NULL
    `);

    return updatedPayment;
  });
}

export async function markPaymentPaidByOrderAtomically(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paidAt?: Date;
}) {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, input.razorpayOrderId))
      .for("update")
      .limit(1);

    if (!payment) throw new Error("Payment order not found");
    if (payment.status === "paid") return payment;

    const [updatedPayment] = await tx
      .update(payments)
      .set({
        status: "paid",
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        paidAt: input.paidAt ?? new Date(),
      })
      .where(
        and(
          eq(payments.id, payment.id),
          eq(payments.razorpayOrderId, input.razorpayOrderId),
        ),
      )
      .returning();

    if (!updatedPayment) throw new Error("Failed to finalize payment");

    await tx
      .update(teams)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(teams.id, payment.teamId));

    await tx.execute(sql`
      UPDATE members
      SET attendance_code = gen_random_uuid()::text
      WHERE team_id = ${payment.teamId}
        AND attendance_code IS NULL
    `);

    return updatedPayment;
  });
}

/**
 * Moves a team from `pending_submission` to `in_review` by recording the deck
 * link for a round. Writes both `submissions.status` and `teams.status` in one
 * transaction so the two can never disagree.
 */
export async function submitIdeaAtomically(input: {
  teamId: string;
  roundId: string;
  title: string | null;
  description: string | null;
  driveLink: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${input.teamId}))`,
    );

    const [team] = await tx
      .select({ id: teams.id, status: teams.status })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .for("update")
      .limit(1);

    if (!team) throw new Error("Team not found");
    if (team.status === "in_review")
      throw new Error("Your idea is already under review");
    if (team.status === "accepted")
      throw new Error("Your idea has already been accepted");
    if (team.status === "rejected")
      throw new Error("Your idea was rejected and cannot be resubmitted");

    const now = new Date();
    const values = {
      title: input.title,
      description: input.description,
      driveLink: input.driveLink,
      status: "in_review" as const,
      submittedAt: now,
      updatedAt: now,
      reviewedBy: null,
      reviewedAt: null,
      remarks: null,
    };

    const [submission] = await tx
      .insert(submissions)
      .values({ teamId: input.teamId, roundId: input.roundId, ...values })
      .onConflictDoUpdate({
        target: [submissions.teamId, submissions.roundId],
        set: values,
      })
      .returning();

    if (!submission) throw new Error("Failed to save submission");

    await tx
      .update(teams)
      .set({ status: "in_review", updatedAt: now })
      .where(eq(teams.id, input.teamId));

    return submission;
  });
}

/**
 * Records an admin verdict on a submission and mirrors it onto the team.
 * Only a submission that is `in_review` can be decided, so a verdict cannot be
 * applied twice or to an unsubmitted round.
 */
export async function reviewSubmissionAtomically(input: {
  submissionId: string;
  status: "accepted" | "rejected";
  adminId: string;
  remarks?: string | null;
}) {
  return db.transaction(async (tx) => {
    // Unlocked read purely to learn the team id: the advisory lock is always
    // taken before any row lock, in the same order as every other writer here.
    const [owner] = await tx
      .select({ teamId: submissions.teamId })
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .limit(1);

    if (!owner) throw new Error("Submission not found");

    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${owner.teamId}))`,
    );

    const [existing] = await tx
      .select({
        id: submissions.id,
        teamId: submissions.teamId,
        status: submissions.status,
      })
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .for("update")
      .limit(1);

    if (!existing) throw new Error("Submission not found");
    if (existing.status !== "in_review")
      throw new Error("Only a submission under review can be decided");

    const now = new Date();

    const [submission] = await tx
      .update(submissions)
      .set({
        status: input.status,
        reviewedBy: input.adminId,
        reviewedAt: now,
        remarks: input.remarks?.trim() || null,
        updatedAt: now,
      })
      .where(eq(submissions.id, existing.id))
      .returning();

    const [team] = await tx
      .update(teams)
      .set({
        status: input.status,
        reviewedBy: input.adminId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(teams.id, existing.teamId))
      .returning();

    if (!submission || !team) throw new Error("Failed to record the review");

    return { submission, team };
  });
}

/**
 * super_admin escape hatch. The normal path is `submitIdeaAtomically` /
 * `reviewSubmissionAtomically`; this exists to correct a mistake or to reopen a
 * team, including for the next round. Resetting to `pending_submission` also
 * clears the active round's submission so the team can actually submit again.
 */
export async function overrideTeamStatusAtomically(input: {
  teamId: string;
  status: ReviewStatus;
  adminId: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${input.teamId}))`,
    );

    const [existing] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .for("update")
      .limit(1);

    if (!existing) throw new Error("Team not found");

    const now = new Date();

    const [team] = await tx
      .update(teams)
      .set({
        status: input.status,
        reviewedBy: input.adminId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(teams.id, input.teamId))
      .returning();

    if (!team) throw new Error("Failed to update the team");

    if (input.status === "pending_submission") {
      const [activeRound] = await tx
        .select({ id: evaluationRounds.id })
        .from(evaluationRounds)
        .where(eq(evaluationRounds.isActive, true))
        .limit(1);

      if (activeRound) {
        await tx
          .update(submissions)
          .set({
            status: "pending_submission",
            submittedAt: null,
            reviewedBy: null,
            reviewedAt: null,
            remarks: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(submissions.teamId, input.teamId),
              eq(submissions.roundId, activeRound.id),
            ),
          );
      }
    }

    return team;
  });
}

export type ScoreCriteria = {
  problemUnderstanding: number;
  ideaFeasibility: number;
  decisionMaking: number;
  coordination: number;
};

/**
 * Write one judge's scores for one team in one round.
 *
 * Every gate is re-checked here, inside the transaction, rather than trusted
 * from the page that rendered the form: a judge can keep a sheet open across a
 * reassignment, a second tab, or a round switch, and none of those may result
 * in a score the panel no longer owns. The advisory lock is on the team, so two
 * judges of the same panel scoring the same team serialize against each other
 * the way the roster and payment writes already do.
 *
 * `scores.score` is a generated column — the four criteria are written and the
 * total falls out of them.
 */
export async function upsertPanelScoreAtomically(input: {
  roundId: string;
  teamId: string;
  evaluatorId: string;
  criteria: ScoreCriteria;
  remarks?: string | null;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${input.teamId}))`,
    );

    const [round] = await tx
      .select({
        id: evaluationRounds.id,
        eventDate: evaluationRounds.eventDate,
      })
      .from(evaluationRounds)
      .where(eq(evaluationRounds.id, input.roundId))
      .limit(1);

    if (!round) throw new Error("Evaluation round not found");

    const [panelMember] = await tx
      .select({ panelId: panelMembers.panelId })
      .from(panelMembers)
      .where(eq(panelMembers.adminId, input.evaluatorId))
      .limit(1);

    if (!panelMember)
      throw new Error(
        "You are not on a judging panel. Ask an admin to add you.",
      );

    const [assignment] = await tx
      .select({ panelId: teamPanelAssignments.panelId })
      .from(teamPanelAssignments)
      .where(
        and(
          eq(teamPanelAssignments.teamId, input.teamId),
          eq(teamPanelAssignments.roundId, input.roundId),
        ),
      )
      .limit(1);

    if (!assignment || assignment.panelId !== panelMember.panelId)
      throw new Error("This team is not assigned to your panel for this round");

    const [team] = await tx
      .select({ status: teams.status, paymentStatus: teams.paymentStatus })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .limit(1);

    if (!team) throw new Error("Team not found");
    if (team.status !== "accepted")
      throw new Error("Only accepted teams can be scored");
    if (team.paymentStatus !== "paid")
      throw new Error("Only teams that have paid can be scored");

    // Judging happens in the room. A team nobody scanned on this round's day
    // did not turn up for it, and a score against it would be invented.
    const { rows: present } = await tx.execute<{ present: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        WHERE m.team_id = ${input.teamId}
          AND a.event_date = ${round.eventDate}
      ) AS present
    `);

    if (!present[0]?.present)
      throw new Error("This team has not been marked present for this round");

    const values = {
      problemUnderstanding: input.criteria.problemUnderstanding.toFixed(2),
      ideaFeasibility: input.criteria.ideaFeasibility.toFixed(2),
      decisionMaking: input.criteria.decisionMaking.toFixed(2),
      coordination: input.criteria.coordination.toFixed(2),
      remarks: input.remarks?.trim() || null,
    };

    const [row] = await tx
      .insert(scores)
      .values({
        teamId: input.teamId,
        roundId: input.roundId,
        evaluatorId: input.evaluatorId,
        ...values,
      })
      .onConflictDoUpdate({
        target: [scores.teamId, scores.roundId, scores.evaluatorId],
        set: values,
      })
      .returning();

    if (!row) throw new Error("Failed to save score");
    return row;
  });
}

/**
 * Point a set of teams at one panel for one round, replacing whatever panel
 * they were on. `unique(team_id, round_id)` means a team has exactly one panel
 * per round, so the conflict clause is the reassignment.
 */
export async function assignTeamsToPanelAtomically(input: {
  teamIds: string[];
  roundId: string;
  panelId: string;
  adminId: string;
}) {
  if (input.teamIds.length === 0) return [];

  return db.transaction(async (tx) => {
    const [panel] = await tx
      .select({ id: panels.id })
      .from(panels)
      .where(eq(panels.id, input.panelId))
      .limit(1);

    if (!panel) throw new Error("Panel not found");

    const [round] = await tx
      .select({ id: evaluationRounds.id })
      .from(evaluationRounds)
      .where(eq(evaluationRounds.id, input.roundId))
      .limit(1);

    if (!round) throw new Error("Evaluation round not found");

    return tx
      .insert(teamPanelAssignments)
      .values(
        input.teamIds.map((teamId) => ({
          teamId,
          roundId: input.roundId,
          panelId: input.panelId,
          assignedBy: input.adminId,
        })),
      )
      .onConflictDoUpdate({
        target: [teamPanelAssignments.teamId, teamPanelAssignments.roundId],
        set: {
          panelId: input.panelId,
          assignedBy: input.adminId,
          assignedAt: new Date(),
        },
      })
      .returning();
  });
}

/**
 * Replace a panel's roster in one shot. Delete-then-insert rather than a diff:
 * `unique(admin_id)` means adding a judge who is on another panel has to fail
 * loudly, and a partial apply would leave the panel half-staffed mid-round.
 */
export async function setPanelJudgesAtomically(input: {
  panelId: string;
  adminIds: string[];
}) {
  return db.transaction(async (tx) => {
    const [panel] = await tx
      .select({ id: panels.id })
      .from(panels)
      .where(eq(panels.id, input.panelId))
      .limit(1);

    if (!panel) throw new Error("Panel not found");

    await tx
      .delete(panelMembers)
      .where(eq(panelMembers.panelId, input.panelId));

    if (input.adminIds.length === 0) return [];

    return tx
      .insert(panelMembers)
      .values(
        input.adminIds.map((adminId) => ({ panelId: input.panelId, adminId })),
      )
      .returning();
  });
}
