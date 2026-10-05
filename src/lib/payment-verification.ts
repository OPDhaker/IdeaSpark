import { VERIFIED_PAYMENT_IDS } from "@/lib/verified-payment-ids";

const verifiedPaymentIds = new Set(VERIFIED_PAYMENT_IDS);

/**
 * Whether a team's self-reported payment ID appears in the Razorpay export as a
 * captured, full-fee payment. `false` means "not in the sheet we last
 * generated from", not "unpaid" — the desk checks those by hand.
 */
export function isPaymentVerified(paymentId: string | null): boolean {
  if (!paymentId) return false;
  return verifiedPaymentIds.has(paymentId.trim());
}
