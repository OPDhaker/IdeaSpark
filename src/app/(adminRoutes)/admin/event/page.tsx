import { getEventControls } from "@/app/actions";
import { LeaderboardToggle } from "./leaderboard-toggle";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Event controls — IdeaSpark 3.0",
};

export default async function AdminEventPage() {
  // `requireAdminRole(["super_admin"])` lives in the action, so this throws for
  // anyone else — the hidden nav row is presentation only.
  const config = await getEventControls();

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[820px] gap-8">
        <header>
          <h1 className="font-serif text-5xl leading-none tracking-[-0.03em]">
            Event controls
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            What teams can see, and when.
          </p>
        </header>

        {config ? (
          <LeaderboardToggle published={config.leaderboardPublished} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Event configuration is not initialized. Run <code>db:seed</code>{" "}
            first.
          </p>
        )}
      </div>
    </div>
  );
}
