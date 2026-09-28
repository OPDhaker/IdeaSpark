import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { eventConfig, payments, teams } from "@/db/schema";
import { createPaymentRecord } from "@/db/transactions";
import { log } from "@/lib/audit";
import { auth } from "@/lib/auth/server";
import { rupeesToPaise } from "@/lib/money";
import { getRazorpayClient } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth.getSession();
  const userId = session.data?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [team] = await db
    .select({
      id: teams.id,
      status: teams.status,
      paymentStatus: teams.paymentStatus,
    })
    .from(teams)
    .where(eq(teams.leadUserId, userId))
    .limit(1);

  if (!team)
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (team.status !== "accepted") {
    return NextResponse.json(
      { error: "Payment is available only after acceptance" },
      { status: 409 },
    );
  }
  if (team.paymentStatus === "paid") {
    return NextResponse.json(
      { error: "Team is already paid" },
      { status: 409 },
    );
  }

  const [existingPayment] = await db
    .select({
      orderId: payments.razorpayOrderId,
      amount: payments.amount,
      status: payments.status,
    })
    .from(payments)
    .where(eq(payments.teamId, team.id))
    .limit(1);

  try {
    const { client, keyId } = getRazorpayClient();
    if (existingPayment) {
      if (existingPayment.status === "paid") {
        return NextResponse.json(
          { error: "Team is already paid" },
          { status: 409 },
        );
      }

      return NextResponse.json({
        keyId,
        orderId: existingPayment.orderId,
        amount: rupeesToPaise(existingPayment.amount),
        currency: "INR",
      });
    }

    const [config] = await db
      .select({ registrationFee: eventConfig.registrationFee })
      .from(eventConfig)
      .where(eq(eventConfig.id, 1))
      .limit(1);
    if (!config) {
      return NextResponse.json(
        { error: "Event configuration is not initialized" },
        { status: 503 },
      );
    }

    const amount = rupeesToPaise(config.registrationFee);
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Registration fee must be greater than zero" },
        { status: 503 },
      );
    }

    const order = await client.orders.create({
      amount,
      currency: "INR",
      receipt: team.id,
      notes: { team_id: team.id },
    });
    const payment = await createPaymentRecord({
      teamId: team.id,
      razorpayOrderId: order.id,
      amount: config.registrationFee,
    });
    await log(userId, "payment.order.create", "payment", payment.id);

    return NextResponse.json({
      keyId,
      orderId: payment.razorpayOrderId,
      amount: rupeesToPaise(payment.amount),
      currency: "INR",
    });
  } catch (error) {
    console.error("Unable to create Razorpay order", error);
    return NextResponse.json(
      { error: "Unable to start payment. Please try again." },
      { status: 502 },
    );
  }
}
