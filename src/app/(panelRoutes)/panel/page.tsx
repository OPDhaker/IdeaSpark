import { ArrowRight, CircleAlert, Users } from "lucide-react";
import Link from "next/link";
import { getPanelRounds } from "@/actions/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Judging Panel — IdeaSpark 3.0",
};

function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${day}T00:00:00+05:30`));
}

export default async function PanelOverviewPage() {
  const { admin, rounds, panel, judges } = await getPanelRounds();

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[820px] gap-12">
        <header>
          <h1 className="font-serif text-5xl leading-none tracking-[-0.03em]">
            Judging Panel
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Signed in as {admin.name}.
          </p>
        </header>

        {/*
          A judge with no panel can reach every page here and score nothing, so
          say why once, at the top, instead of letting each round look empty.
        */}
        {panel ? (
          <section className="grid gap-4">
            <h2 className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.12em]">
              <Users aria-hidden className="size-3.5" />
              {panel.name}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {judges.map((judge) => (
                <li key={judge.id}>
                  <Badge
                    variant={judge.id === admin.id ? "default" : "outline"}
                  >
                    {judge.name}
                    {judge.id === admin.id ? " (you)" : ""}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm">
              Each of you scores every assigned team on your own screen. A
              team&apos;s final number is this panel&apos;s average, per
              criterion, out of 50.
            </p>
          </section>
        ) : (
          <section className="flex items-start gap-3 rounded-md border border-foreground/15 p-5">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-medium">You are not on a judging panel</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                An admin has to add you to one before any team shows up here.
              </p>
            </div>
          </section>
        )}

        <section className="grid gap-4">
          <h2 className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            Rounds
          </h2>
          {rounds.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No evaluation rounds exist yet.
            </p>
          ) : (
            <ul className="grid gap-3">
              {rounds.map((round) => (
                <li
                  key={round.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-foreground/15 p-5"
                >
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      {round.name}
                      {round.isActive ? <Badge>Live</Badge> : null}
                    </p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {formatDay(round.eventDate)}
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/panel/${round.slug}`}>
                      Score teams
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
