"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

const INTERVAL_MS = 10_000;

/**
 * Keeps the page live by polling: every 10s, and the moment the tab comes
 * back into view, it re-renders the server page. Client state such as the
 * search box survives, and the role check runs again each time, so a revoked
 * volunteer stops getting data.
 *
 * This is a timer, not the "refresh after an action" that `revalidatePath`
 * already covers. A hidden tab skips its ticks, and a tick that lands while
 * the previous refresh is still in flight is dropped rather than queued.
 */
export function AutoRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || pendingRef.current) return;
      startTransition(() => router.refresh());
    };

    const timer = setInterval(refresh, INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
