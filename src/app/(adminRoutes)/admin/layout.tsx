import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * `src/proxy.ts` only proves a visitor is signed in — it has no concept of
 * roles, so without this any Google account could load the control room. The
 * individual actions still check their own roles; this only decides who gets
 * to see the page at all.
 *
 * It sits at `admin/layout.tsx`, not at the `(adminRoutes)` root, because the
 * group adds no path segment and only this position yields an unambiguous
 * `LayoutProps<"/admin">`.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!(await isAdmin())) redirect("/");
  return children;
}
