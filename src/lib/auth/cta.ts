import { NEON_AUTH_COOKIE_PREFIX } from "@neondatabase/auth/server";
import { cookies } from "next/headers";
import { getMyTeam } from "@/app/actions";

/** Which primary call-to-action the landing page should offer. */
export type CtaState = "signed-out" | "no-team" | "has-team";

export async function getCtaState(): Promise<CtaState> {
  const store = await cookies();

  // Mirrors the middleware's own `hasSessionToken` check. `auth.getSession()`
  // costs a ~300ms upstream round trip even when nobody is signed in, and this
  // runs on the landing page, so anonymous visitors must not pay for it.
  const hasSessionCookie = store
    .getAll()
    .some((cookie) => cookie.name.startsWith(NEON_AUTH_COOKIE_PREFIX));
  if (!hasSessionCookie) return "signed-out";

  try {
    return (await getMyTeam()) ? "has-team" : "no-team";
  } catch {
    // Stale or half-written cookie — treat it as signed out rather than 500
    // the landing page.
    return "signed-out";
  }
}
