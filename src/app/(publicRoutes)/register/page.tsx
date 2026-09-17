import { redirect } from "next/navigation";
import { getMyTeam } from "@/app/actions";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // proxy.ts already guards this route; the check is repeated here so a matcher
  // mistake degrades into a redirect instead of a 500 from `requireLead`.
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/login");

  const team = await getMyTeam();
  if (team) redirect("/dashboard");

  return <div>RegisterPage</div>;
}
