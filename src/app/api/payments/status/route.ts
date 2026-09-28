import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, teams } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth.getSession();
  const userId = session.data?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [team] = await db
    .select({ id: teams.id, paymentStatus: teams.paymentStatus })
    .from(teams)
    .where(eq(teams.leadUserId, userId))
    .limit(1);
  if (!team)
    return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const [payment] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.teamId, team.id))
    .limit(1);

  return NextResponse.json({
    status:
      team.paymentStatus === "paid" ? "paid" : (payment?.status ?? "created"),
  });
}
