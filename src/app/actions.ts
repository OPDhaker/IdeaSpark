"use server";
import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  attendance,
  auditLog,
  departments,
  eventConfig,
  ideas,
  payments,
  teamMembers,
  teams,
  tracks,
  dbTeams,
  dbMembers,
  dbAttendance,
  dbAdmins,
} from "@/db/schema";
import { db } from "@/lib";
import { auth } from "@/lib/auth/server";
import { isAdmin } from "@/lib/roles";

export async function getMyTeam() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) return null;
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.leadUserId, session.user.id));
  return team ?? null;
}

async function requireLead() {
  const { data: session } = await auth.getSession();
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user;
}

async function requireAdminActor() {
  if (!(await isAdmin())) throw new Error("Unauthorized: admin only");
  const { data: session } = await auth.getSession();
  return session!.user;
}

export async function scanAttendance(attendanceCode: string) {
  await requireAdminActor();

  const code = attendanceCode.trim();

  if (!code) {
    throw new Error("Attendance code is required");
  }

  const [member] = await db
    .select()
    .from(dbMembers)
    .where(eq(dbMembers.attendanceCode, code));

  if (!member) {
    throw new Error("Invalid attendance code");
  }

  const [team] = await db
    .select()
    .from(dbTeams)
    .where(eq(dbTeams.id, member.teamId));

  if (!team) {
    throw new Error("Team not found for the member");
  }

  const eventDate = new Date().toISOString().slice(0, 10);

  const [record] = await db
    .insert(dbAttendance)
    .values({
      id: randomUUID(),
      memberId: member.id,
      eventDate,
      scannedBy: null,
    })
    .onConflictDoNothing()
    .returning();

  if (!record) {
    return {
      status: "already_present",
      member,
      team,
      eventDate,
    };
  }

  return {
    status: "recorded",
    member,
    team,
    eventDate,
    attendanceId: record.id,
  };
}

async function log(
  actorUserId: string | null,
  action: string,
  targetType: string,
  targetId: number,
  meta?: unknown,
) {
  await db.insert(auditLog).values({
    actorUserId,
    action,
    targetType,
    targetId,
    meta: meta ? JSON.stringify(meta) : null,
  });
}

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 4;

export type MemberInput = {
  name: string;
  raNumber: string;
  phone: string;
  netId: string;
  department: string; // department code, see departments table
  faName: string;
  faMobile: string;
  faEmail: string;
};

export async function createTeam(name: string, trackId: number) {
  const user = await requireLead();
  await assertBefore("registrationDeadline");
  if (await getTeamFor(user.id)) throw new Error("You already have a team");
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!track) throw new Error("Invalid track");
  const [team] = await db
    .insert(teams)
    .values({ name, trackId, leadUserId: user.id })
    .returning();
  await log(user.id, "team.create", "team", team.id, { name, trackId });
  revalidatePath("/dashboard");
  return team;
}

async function getTeamFor(leadUserId: string) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.leadUserId, leadUserId));
  return team ?? null;
}

async function assertEditable(teamId: number) {
  const [{ value: paid }] = await db
    .select({ value: count() })
    .from(payments)
    .where(and(eq(payments.teamId, teamId), eq(payments.status, "approved")));
  if (paid > 0) throw new Error("Team is locked after payment approval");
}

async function assertBefore(
  field: "registrationDeadline" | "submissionDeadline",
) {
  const [cfg] = await db.select().from(eventConfig);
  if (cfg?.[field] && Date.now() > cfg[field].getTime())
    throw new Error("Deadline passed");
}

export async function addMember(input: MemberInput) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");
  await assertEditable(team.id);
  const [dept] = await db
    .select()
    .from(departments)
    .where(eq(departments.code, input.department));
  if (!dept) throw new Error("Invalid department code");
  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));
  if (memberCount >= MAX_MEMBERS)
    throw new Error(`Team is full (max ${MAX_MEMBERS} members)`);
  const [member] = await db
    .insert(teamMembers)
    .values({ ...input, teamId: team.id, attendanceCode: randomUUID() })
    .returning();
  await log(user.id, "team.member.add", "team", team.id, {
    memberId: member.id,
  });
  revalidatePath("/dashboard");
  return member;
}

export async function removeMember(memberId: number) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("No team");
  await assertEditable(team.id);
  const [member] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, team.id)));
  if (!member) throw new Error("Not your team member");
  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
  await log(user.id, "team.member.remove", "team", team.id, { memberId });
  revalidatePath("/dashboard");
}

export async function setTrack(trackId: number) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");
  await assertEditable(team.id);
  const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
  if (!track) throw new Error("Invalid track");
  await db.update(teams).set({ trackId }).where(eq(teams.id, team.id));
  revalidatePath("/dashboard");
}

export async function submitIdea(
  title: string,
  description: string,
  pptLink: string,
  round = 1,
) {
  const user = await requireLead();
  await assertBefore("submissionDeadline");
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");
  if (team.status !== "approved")
    throw new Error("Team not approved for submission");
  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));
  if (memberCount < MIN_MEMBERS)
    throw new Error(`At least ${MIN_MEMBERS} members required to submit`);
  const [existing] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.teamId, team.id), eq(ideas.round, round)));
  if (existing) throw new Error("Already submitted for this round");
  const [idea] = await db
    .insert(ideas)
    .values({ teamId: team.id, title, description, pptLink, round })
    .returning();
  await log(user.id, "idea.submit", "idea", idea.id, { round });
  revalidatePath("/dashboard");
  return idea;
}

export async function submitPayment(
  amount: number,
  txnRef: string,
  screenshotUrl?: string,
) {
  const user = await requireLead();
  const team = await getTeamFor(user.id);
  if (!team) throw new Error("Create your team first");
  const [unpaid] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.teamId, team.id), eq(ideas.status, "accepted_unpaid")));
  if (!unpaid) throw new Error("Pay only after your idea is accepted");
  if (amount <= 0 || !Number.isInteger(amount))
    throw new Error("Invalid amount (integer paise required)");
  const [payment] = await db
    .insert(payments)
    .values({ teamId: team.id, amount, txnRef, screenshotUrl })
    .returning();
  await log(user.id, "payment.submit", "payment", payment.id, { amount });
  revalidatePath("/dashboard");
  return payment;
}

export async function setTeamStatus(
  teamId: number,
  status: "pending" | "approved" | "rejected",
) {
  const admin = await requireAdminActor();
  const [team] = await db
    .update(teams)
    .set({ status, reviewedBy: admin.id, reviewedAt: new Date() })
    .where(eq(teams.id, teamId))
    .returning();
  if (!team) throw new Error("Team not found");
  await log(admin.id, `team.${status}`, "team", teamId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function reviewIdea(
  ideaId: number,
  status: "in_review" | "accepted_unpaid" | "accepted_paid" | "rejected",
) {
  const admin = await requireAdminActor();
  const [idea] = await db
    .update(ideas)
    .set({ status })
    .where(eq(ideas.id, ideaId))
    .returning();
  if (!idea) throw new Error("Idea not found");
  await log(admin.id, `idea.${status}`, "idea", ideaId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function reviewPayment(
  paymentId: number,
  status: "approved" | "rejected",
) {
  const admin = await requireAdminActor();
  const [payment] = await db
    .update(payments)
    .set({ status, reviewedBy: admin.id, reviewedAt: new Date() })
    .where(eq(payments.id, paymentId))
    .returning();
  if (!payment) throw new Error("Payment not found");
  if (status === "approved") {
    // neon-http has no interactive transactions; batch = atomic round trip
    await db.batch([
      db
        .update(ideas)
        .set({ status: "accepted_paid" })
        .where(
          and(
            eq(ideas.teamId, payment.teamId),
            eq(ideas.status, "accepted_unpaid"),
          ),
        ),
    ]);
  }
  await log(admin.id, `payment.${status}`, "payment", paymentId);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
