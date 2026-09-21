"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { GoogleMark } from "./google-mark";

/** Shared by the two mirrored tracks below. `fr` values interpolate, so
 * collapsing a track from `1fr` to `0fr` animates the button's own width
 * without ever measuring it in JavaScript. */
const track =
  "grid transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

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
      {/* `h-[49px]` is explicit because `<Button>`'s default size ships `h-9`;
          a fixed height also keeps the pending morph to width alone.
          `disabled:opacity-100` cancels the base's `disabled:opacity-50` so the
          loading button stays full-strength — `disabled:pointer-events-none`
          still blocks a second click. */}
      <Button
        type="button"
        variant="outline"
        onClick={handleSignIn}
        disabled={pending}
        aria-busy={pending}
        data-pending={pending}
        className="group h-[49px] gap-0 rounded-full px-4 font-semibold text-lg tracking-[-0.36px] active:scale-[0.98] disabled:opacity-100"
      >
        <span
          className={`${track} grid-cols-[1fr] group-data-[pending=true]:grid-cols-[0fr]`}
        >
          <span className="flex min-w-0 items-center gap-3 overflow-hidden whitespace-nowrap transition-opacity duration-200 group-data-[pending=true]:opacity-0 motion-reduce:transition-none">
            <GoogleMark className="size-6 shrink-0" />
            Continue with Google
          </span>
        </span>

        <span
          className={`${track} grid-cols-[0fr] group-data-[pending=true]:grid-cols-[1fr]`}
        >
          <span className="flex min-w-0 justify-center overflow-hidden">
            <LoaderCircle
              aria-hidden
              className="size-6 shrink-0 animate-spin"
            />
          </span>
        </span>

        {/* The visible label is clipped to zero width while pending, so a
            screen reader would otherwise be left with a nameless button. */}
        <output className="sr-only">
          {pending ? "Redirecting to Google…" : ""}
        </output>
      </Button>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
