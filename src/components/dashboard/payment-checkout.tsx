"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type OrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
};

type CheckoutResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (result: CheckoutResult) => void;
  modal: { ondismiss: () => void };
};

type CheckoutInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: { error?: { description?: string } }) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => CheckoutInstance;
  }
}

export function PaymentCheckout() {
  const router = useRouter();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function waitForWebhookConfirmation() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await fetch("/api/payments/status", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not check payment status");

      const result: { status: string } = await response.json();
      if (result.status === "paid") {
        setMessage("Payment confirmed. Your passes are ready.");
        setBusy(false);
        router.refresh();
        return;
      }
      if (result.status === "failed") {
        setMessage("Payment failed. You can try again.");
        setBusy(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setMessage(
      "Payment is awaiting confirmation. Refresh this page to check again.",
    );
    setBusy(false);
  }

  async function startPayment() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/order", { method: "POST" });
      const orderResult = (await response.json()) as
        | OrderResponse
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in orderResult
            ? (orderResult.error ?? "Unable to start payment")
            : "Unable to start payment",
        );
      }
      if (!("orderId" in orderResult))
        throw new Error("Invalid order response");

      if (!window.Razorpay) throw new Error("Checkout is not ready yet");

      let checkoutReturned = false;
      const checkout = new window.Razorpay({
        key: orderResult.keyId,
        amount: orderResult.amount,
        currency: orderResult.currency,
        name: "IdeaSpark 3.0",
        description: "Team registration fee",
        order_id: orderResult.orderId,
        handler: async (result) => {
          checkoutReturned = true;
          setMessage("Payment received. Waiting for Razorpay confirmation…");

          try {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result),
            });
            const verification = (await verifyResponse.json()) as {
              confirmed?: boolean;
              error?: string;
            };
            if (!verifyResponse.ok) {
              throw new Error(
                verification.error ?? "Payment verification failed",
              );
            }
            if (verification.confirmed) {
              setMessage("Payment confirmed. Your passes are ready.");
              setBusy(false);
              router.refresh();
              return;
            }

            await waitForWebhookConfirmation();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Payment confirmation is pending.",
            );
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (!checkoutReturned) {
              setBusy(false);
              setMessage("Checkout closed. No payment was confirmed.");
            }
          },
        },
      });

      checkout.on("payment.failed", (result) => {
        setMessage(
          result.error?.description ?? "Payment failed. You can try again.",
        );
        setBusy(false);
      });
      checkout.open();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to start payment",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptLoaded(true)}
      />
      <Button
        type="button"
        className="mt-6 w-full"
        disabled={!scriptLoaded || busy}
        onClick={startPayment}
      >
        {busy ? "Processing payment…" : "Pay registration fee"}
      </Button>
      {message ? (
        <p
          aria-live="polite"
          className="mt-2 text-center text-muted-foreground text-xs"
        >
          {message}
        </p>
      ) : null}
    </>
  );
}
