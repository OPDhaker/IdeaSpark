import { Trophy } from "lucide-react";
import { getLeaderboardView } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { DAY_MAX, FINAL_MAX, PANEL_TYPES, panelMax } from "@/db/schema";
import { cn } from "@/lib/utils";
import { CardBody, CardTitle, DashCard } from "../_components/panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard | IdeaSpark 3.0",
};

/** Ties share a rank: 1, 2, 2, 4. */
function withRanks(rows: { total: string }[]) {
  let rank = 0;
  let previous: number | null = null;
  return rows.map((row, index) => {
    const score = Number(row.total);
    if (previous === null || score !== previous) {
      rank = index + 1;
      previous = score;
    }
    return rank;
  });
}

export default async function LeaderBoardPage() {
  const view = await getLeaderboardView();

  // The gate is enforced here, not only by locking the nav item — guessing the
  // URL has to hit the same refusal.
  if (!view.visible) {
    return (
      <div className="p-6 md:p-12">
        <div className="mx-auto w-full max-w-[820px]">
          <DashCard className="text-center">
            <Trophy
              aria-hidden
              className="mx-auto size-12 stroke-1 text-muted-foreground"
            />
            <div className="mt-5">
              <CardTitle>Scores aren&apos;t out yet</CardTitle>
              <CardBody>Scores go up once judging is finished.</CardBody>
            </div>
          </DashCard>
        </div>
      </div>
    );
  }

  const ranks = withRanks(view.rows);

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[820px] gap-16">
        <header>
          <h1 className="font-serif text-5xl leading-none tracking-[-0.03em]">
            Leaderboard
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Ranked by the average of both days, out of {FINAL_MAX}.
          </p>
        </header>

        {view.rows.length === 0 ? (
          <DashCard className="text-center">
            <Trophy
              aria-hidden
              className="mx-auto size-12 stroke-1 text-muted-foreground"
            />
            <div className="mt-5">
              <CardTitle>No scores yet</CardTitle>
              <CardBody>
                Judging hasn&apos;t started. Teams appear here as soon as the
                first scores are in.
              </CardBody>
            </div>
          </DashCard>
        ) : (
          <DashCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-foreground/15 border-b text-left text-muted-foreground text-xs uppercase tracking-[0.12em]">
                  <th scope="col" className="w-16 px-6 py-4 font-normal">
                    #
                  </th>
                  <th scope="col" className="px-6 py-4 font-normal">
                    Team
                  </th>
                  <th scope="col" className="px-6 py-4 font-normal">
                    Track
                  </th>
                  {view.rounds.map((round, index) => (
                    <th
                      key={round.id}
                      scope="col"
                      className="whitespace-nowrap px-6 py-4 text-right font-normal"
                    >
                      Day {index + 1}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="whitespace-nowrap px-6 py-4 text-right font-normal"
                  >
                    Total / {FINAL_MAX}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row, index) => {
                  const mine = row.teamId === view.myTeamId;
                  return (
                    <tr
                      key={row.teamId}
                      className={cn(
                        "border-foreground/10 border-b last:border-b-0",
                        // Own row sticks so it stays findable in a long board.
                        mine &&
                          "sticky top-0 bottom-0 z-10 bg-accent text-accent-foreground",
                      )}
                    >
                      <td className="px-6 py-4 tabular-nums">{ranks[index]}</td>
                      <td className="px-6 py-4 font-medium">
                        {row.teamName}
                        {mine ? (
                          <span className="ml-2 text-xs opacity-70">
                            (your team)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        {row.trackName ? (
                          <Badge variant="outline">{row.trackName}</Badge>
                        ) : (
                          <span className="text-muted-foreground">|</span>
                        )}
                      </td>
                      {view.rounds.map((round) => {
                        const day = row.days.find(
                          (d) => d.roundId === round.id,
                        );
                        return (
                          <td
                            key={round.id}
                            className="px-6 py-4 text-right text-muted-foreground tabular-nums"
                          >
                            {day ? Number(day.total).toFixed(1) : "|"}
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right font-medium tabular-nums">
                        {Number(row.total).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DashCard>
        )}

        <p className="text-muted-foreground text-xs">
          Each day is out of {DAY_MAX}: {PANEL_TYPES.main.label}&apos;s average
          out of {panelMax("main")}, plus {PANEL_TYPES.risk.label}&apos;s Risk
          Management average out of {panelMax("risk")}. The total is the average
          of both days, so a day a team did not play counts as zero. Only
          accepted, paid teams scored by both panels on every day they played
          appear here.
        </p>
      </div>
    </div>
  );
}
