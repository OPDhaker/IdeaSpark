import { CalendarX } from "lucide-react";
import { getTeamPanelDirectory, listEvaluationRounds } from "@/db/queries";
import { requireAdminRole } from "@/lib/roles";
import { AutoRefresh } from "./_components/auto-refresh";
import { TeamPanelList } from "./_components/team-panel-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team panels | IdeaSpark 3.0",
};

/**
 * Which Type 1 panel each team sits with, for the volunteers walking teams to
 * their rooms. Replaces forwarding the panel CSV by hand: `<AutoRefresh>`
 * re-renders this page every few seconds, so a reassignment at
 * `/admin/panels` reaches every open phone without anyone resending a file.
 */
export default async function TeamPanelsPage({
  searchParams,
}: PageProps<"/admin/team-panels">) {
  // The hidden nav row is presentation only; this throws for anyone else.
  await requireAdminRole(["volunteer", "super_admin"]);

  const { round, panel } = await searchParams;
  const slug = Array.isArray(round) ? round[0] : round;
  // `?panel=` repeats, one per panel the volunteer covers.
  const initialPanels = panel === undefined ? null : [panel].flat();

  const rounds = await listEvaluationRounds();
  const selected =
    rounds.find((r) => r.slug === slug) ??
    rounds.find((r) => r.isActive) ??
    rounds.at(-1);

  if (!selected) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
          <CalendarX aria-hidden className="size-8 text-muted-foreground" />
          <p className="font-medium">No evaluation rounds yet</p>
          <p className="text-muted-foreground text-sm">
            Panels are assigned per round. This list fills in once a super admin
            creates one.
          </p>
        </div>
      </Shell>
    );
  }

  const rows = await getTeamPanelDirectory(selected.id);

  return (
    <Shell>
      <AutoRefresh />
      <TeamPanelList
        rows={rows}
        rounds={rounds.map((r) => ({ slug: r.slug, name: r.name }))}
        roundSlug={selected.slug}
        initialPanels={initialPanels}
        fetchedAt={new Date().toISOString()}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 md:p-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header>
          <h1 className="font-serif text-4xl leading-none tracking-[-0.03em] md:text-5xl">
            Team panels
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Each team's Type 1 panel. Updates live as panels are assigned.
          </p>
        </header>
        {children}
      </div>
    </div>
  );
}
