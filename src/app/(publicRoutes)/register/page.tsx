import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDepartments, getMyTeam, getTracks } from "@/app/actions";
import { db } from "@/db";
import { eventConfig } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { RegistrationForm } from "./_components/registration-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Register — IdeaSpark 3.0",
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-foreground/15 bg-card p-8 text-center">
      <h2 className="font-semibold text-foreground text-xl">{title}</h2>
      <p className="mt-2 text-muted-foreground text-sm">{body}</p>
    </div>
  );
}

export default async function RegisterPage() {
  // proxy.ts already guards this route; the check is repeated here so a matcher
  // mistake degrades into a redirect instead of a 500 from `requireLead`.
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/login");

  const [team, tracks, departments, [config]] = await Promise.all([
    getMyTeam(),
    getTracks(),
    getDepartments(),
    db.select().from(eventConfig).where(eq(eventConfig.id, 1)).limit(1),
  ]);
  if (team) redirect("/dashboard");

  return (
    <main className="min-h-dvh bg-background px-4 py-16 text-foreground md:px-8">
      <div className="mx-auto w-full max-w-2xl">
        {!config ? (
          <Notice
            title="Registration isn't open yet"
            body="The organisers haven't opened registration. Check back soon."
          />
        ) : config.registrationDeadline.getTime() < Date.now() ? (
          <Notice
            title="Registration has closed"
            body="The deadline to register a team has passed."
          />
        ) : tracks.length === 0 ? (
          <Notice
            title="Tracks haven't been announced"
            body="You'll be able to register once the organisers publish the tracks."
          />
        ) : (
          <RegistrationForm
            tracks={tracks}
            departments={departments}
            defaultLeaderName={session.user.name ?? ""}
          />
        )}
      </div>
    </main>
  );
}
