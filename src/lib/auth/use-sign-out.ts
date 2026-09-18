"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * Signs the user out and returns them to the landing page.
 *
 * The `router.refresh()` is load-bearing: `/` resolves its CTA server-side from
 * the session cookie (`getCtaState()` in `src/lib/auth/cta.ts`), so without it
 * the cached RSC payload still renders "Dashboard" for a signed-out visitor.
 *
 * `pending` stays true through the navigation — the component unmounts on the
 * way out, so there is nothing to reset. It is only cleared on failure, which
 * leaves the trigger clickable again.
 */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch (cause) {
      console.error("Sign-out failed:", cause);
      setPending(false);
    }
  }

  return { signOut, pending };
}
