import { CircleAlert, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPanelSheet } from "@/actions/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelSwitcher } from "../_components/panel-switcher";
import { ScoreSheet } from "../_components/score-sheet";
import { TeamNav } from "../_components/team-nav";
import { TeamPicker } from "../_components/team-picker";

export const dynamic = "force-dynamic";

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-foreground/15 p-5">
      <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="mt-1 text-muted-foreground text-sm">{body}</p>
      </div>
    </div>
  );
}

export default async function PanelRoundPage({
  params,
  searchParams,
}: PageProps<"/panel/[round]">) {
  const { round: slug } = await params;
  const { team, panel } = await searchParams;
  const selected = Array.isArray(team) ? team[0] : team;
  const panelFilter = Array.isArray(panel) ? panel[0] : panel;

  const sheet = await getPanelSheet(slug, selected, panelFilter);
  if (!sheet.round) notFound();

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.12em]">
          {sheet.round.name}
          {sheet.round.isActive ? <Badge>Live</Badge> : null}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {sheet.admin.isSuperAdmin && sheet.panelOptions.length > 0 ? (
          <PanelSwitcher
            slug={slug}
            options={sheet.panelOptions}
            viewingPanelId={sheet.viewingPanelId}
            myPanelId={sheet.panel?.id ?? null}
          />
        ) : null}
        <Button asChild variant="ghost">
          <Link href={`/panel/${slug}/leaderboard`}>
            <Trophy aria-hidden />
            Leaderboard
          </Link>
        </Button>
      </div>
    </header>
  );

  if (!sheet.panel && !sheet.admin.isSuperAdmin) {
    return (
      <div className="grid gap-8 p-6 md:p-12">
        {header}
        <Empty
          title="You are not on a judging panel"
          body="An admin has to add you to one before any team shows up here."
        />
      </div>
    );
  }

  const scopeName = sheet.viewingPanelId
    ? (sheet.panelOptions.find((p) => p.id === sheet.viewingPanelId)?.name ??
      sheet.panel?.name ??
      "Your panel")
    : "Every panel";

  if (!sheet.current) {
    return (
      <div className="grid gap-8 p-6 md:p-12">
        {header}
        {/*
          Three separate gates land here — unassigned, unpaid, or nobody
          scanned in — so the copy names all of them rather than guessing.
        */}
        <Empty
          title="No teams to score yet"
          body={`${scopeName} has no teams for ${sheet.round.name}. A team appears once an admin assigns it to a panel, it has been accepted and paid, and at least one member has been scanned in on the day.`}
        />
      </div>
    );
  }

  const current = sheet.current;
  const peers = current.scores.filter(
    (row) => row.evaluatorId !== sheet.admin.id,
  );

  return (
    <div className="grid gap-8 p-6 md:p-12">
      {header}

      <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <TeamPicker
          slug={slug}
          currentId={current.id}
          showPanel={sheet.viewingPanelId === null}
          teams={sheet.teams.map((entry) => ({
            id: entry.id,
            teamName: entry.teamName,
            trackName: entry.trackName,
            scoredByMe: entry.scoredByMe,
            canScore: entry.canScore,
            panelName: entry.panelName,
          }))}
        />

        <div className="grid content-start gap-8">
          <TeamNav
            slug={slug}
            teamName={current.teamName}
            position={sheet.position}
            total={sheet.teams.length}
            previous={sheet.previous}
            next={sheet.next}
            nextUnscored={sheet.nextUnscored}
            scoredByMe={current.scoredByMe}
          />

          {current.trackName ? (
            <div>
              <Badge variant="outline">{current.trackName}</Badge>
            </div>
          ) : null}

          <ScoreSheet
            // Remount on team change so the form's draft state cannot leak
            // from one team onto the next.
            key={current.id}
            roundId={sheet.round.id}
            teamId={current.id}
            teamName={current.teamName}
            myScore={sheet.myScore}
            peerScores={peers}
            canScore={current.canScore}
            panelName={current.panelName}
          />
        </div>
      </div>
    </div>
  );
}
