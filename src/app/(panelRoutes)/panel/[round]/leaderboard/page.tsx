import { Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { getPanelLeaderboardView } from "@/actions/panel";
import { Badge } from "@/components/ui/badge";
import { SCORE_CRITERIA, SCORE_MAX } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Ties share a rank: 1, 2, 2, 4. */
function withRanks(rows: { averageScore: string }[]) {
  let rank = 0;
  let previous: number | null = null;
  return rows.map((row, index) => {
    const score = Number(row.averageScore);
    if (previous === null || score !== previous) {
      rank = index + 1;
      previous = score;
    }
    return rank;
  });
}

export default async function PanelLeaderboardPage({
  params,
}: PageProps<"/panel/[round]/leaderboard">) {
  const { round: slug } = await params;
  const view = await getPanelLeaderboardView(slug);
  if (!view.round) notFound();

  const ranks = withRanks(view.rows);

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[980px] gap-10">
        <header>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            {view.round.name}
          </p>
          <h1 className="mt-2 font-serif text-5xl leading-none tracking-[-0.03em]">
            Leaderboard
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Each team&apos;s panel average, per criterion, out of {SCORE_MAX}.
            Live | no waiting for the event to open.
          </p>
        </header>

        {view.rows.length === 0 ? (
          <div className="rounded-md border border-foreground/15 p-10 text-center">
            <Trophy
              aria-hidden
              className="mx-auto size-12 stroke-1 text-muted-foreground"
            />
            <p className="mt-5 font-medium">No scores yet</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Teams appear here as soon as the first scores are in.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-foreground/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-foreground/15 border-b text-left text-muted-foreground text-xs uppercase tracking-[0.12em]">
                  <th scope="col" className="w-14 px-5 py-4 font-normal">
                    #
                  </th>
                  <th scope="col" className="px-5 py-4 font-normal">
                    Team
                  </th>
                  <th scope="col" className="px-5 py-4 font-normal">
                    Track
                  </th>
                  <th scope="col" className="px-5 py-4 text-right font-normal">
                    Judges
                  </th>
                  {SCORE_CRITERIA.map((criterion) => (
                    <th
                      key={criterion.key}
                      scope="col"
                      className="px-5 py-4 text-right font-normal"
                    >
                      {/* Full label in the accessible name, initials on screen. */}
                      <abbr title={`${criterion.label} / ${criterion.max}`}>
                        {criterion.label
                          .split(" ")
                          .map((word) => word[0])
                          .join("")}
                      </abbr>
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-4 text-right font-normal">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row, index) => (
                  <tr
                    key={row.teamId}
                    className="border-foreground/10 border-b last:border-b-0"
                  >
                    <td className="px-5 py-4 tabular-nums">{ranks[index]}</td>
                    <td className="px-5 py-4 font-medium">{row.teamName}</td>
                    <td className="px-5 py-4">
                      {row.trackName ? (
                        <Badge variant="outline">{row.trackName}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {row.judgeCount}
                    </td>
                    {SCORE_CRITERIA.map((criterion) => (
                      <td
                        key={criterion.key}
                        className="px-5 py-4 text-right text-muted-foreground tabular-nums"
                      >
                        {Number(row[criterion.key]).toFixed(1)}
                      </td>
                    ))}
                    <td className="px-5 py-4 text-right font-medium tabular-nums">
                      {Number(row.averageScore).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
