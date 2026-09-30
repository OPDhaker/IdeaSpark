"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { submitPaymentId } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    __rzp__?: { init?: () => void };
  }
}

const paymentPageUrl = "https://pages.razorpay.com/pl_TdZFxdVedyavh5/view";

export function PaymentSubmission() {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scriptId = "razorpay-embed-btn-js";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.defer = true;
      script.id = scriptId;
      script.src = "https://cdn.razorpay.com/static/embed_btn/bundle.js";
      document.body.appendChild(script);
    } else {
      window.__rzp__?.init?.();
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const result = await submitPaymentId(paymentId);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }

      setMessage("Payment ID saved. Your passes are ready.");
      router.refresh();
    } catch {
      setError("Could not save the payment ID. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="mt-6 self-center max-w-100">
      <div
        className="razorpay-embed-btn ml-[calc(50%-130px)]"
        data-url={paymentPageUrl}
        data-text="Pay Now"
        data-color="#000000"
        data-size="large"
      />

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label
          htmlFor="razorpay-payment-id"
          className="block text-sm font-medium self-center w-full"
        >
          Razorpay payment ID
        </label>
        <Input
          id="razorpay-payment-id"
          name="paymentId"
          autoComplete="off"
          minLength={5}
          maxLength={255}
          pattern="pay_.+"
          placeholder="pay_..."
          title="Payment ID must start with pay_."
          value={paymentId}
          onChange={(event) => setPaymentId(event.target.value)}
          disabled={pending}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving payment ID…" : "Submit payment ID"}
        </Button>
        <p className="text-center text-muted-foreground text-xs">
          Submitting the ID marks your team paid immediately. The ID is not
          automatically verified against Razorpay.
        </p>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {message ? (
          <p aria-live="polite" className="text-center text-sm">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
