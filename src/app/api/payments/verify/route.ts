import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, teams } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Razorpay key secret is not configured" },
      { status: 500 },
    );
  }

  const session = await auth.getSession();
  const userId = session.data?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const orderId = body.razorpay_order_id?.trim();
  const paymentId = body.razorpay_payment_id?.trim();
  const signature = body.razorpay_signature?.trim();

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { error: "Missing payment verification fields" },
      { status: 400 },
    );
  }

  const [payment] = await db
    .select({
      id: payments.id,
      teamId: payments.teamId,
      razorpayOrderId: payments.razorpayOrderId,
      status: payments.status,
    })
    .from(payments)
    .innerJoin(teams, eq(teams.id, payments.teamId))
    .where(
      and(eq(payments.razorpayOrderId, orderId), eq(teams.leadUserId, userId)),
    )
    .limit(1);

  if (!payment) {
    return NextResponse.json(
      { error: "Payment order not found" },
      { status: 404 },
    );
  }

  if (
    !verifyRazorpayPaymentSignature(
      payment.razorpayOrderId,
      paymentId,
      signature,
      secret,
    )
  ) {
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    status: payment.status,
    confirmed: payment.status === "paid",
  });
}
