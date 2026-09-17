"use client";

import { useState } from "react";
import { loginPill } from "@/components/landing/pill";
import { authClient } from "@/lib/auth/client";

export function GoogleSignIn() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setPending(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        // Must be a path the proxy matcher covers — the middleware, not this
        // page, exchanges the OAuth verifier for a session cookie.
        callbackURL: `${window.location.origin}/register`,
      });
    } catch (cause) {
      console.error("Google sign-in error:", cause);
      setError("Could not start sign-in. Please try again.");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSignIn}
        disabled={pending}
        className={loginPill}
      >
        {pending ? "Redirecting…" : "Login with Google"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
