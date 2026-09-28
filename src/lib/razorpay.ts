import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    throw new Error("Razorpay API keys are not configured");

  return {
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
    keyId,
  };
}

function safeEqualHex(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  return safeEqualHex(expected, receivedSignature);
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  receivedSignature: string,
  secret: string,
) {
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`, "utf8")
    .digest("hex");
  return safeEqualHex(expected, receivedSignature);
}
