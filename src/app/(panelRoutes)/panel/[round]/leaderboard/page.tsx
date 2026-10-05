import { Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { getPanelLeaderboardView } from "@/actions/panel";
import { Badge } from "@/components/ui/badge";
import { DAY_MAX, PANEL_TYPES, panelMax } from "@/db/schema";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Ties share a rank: 1, 2, 2, 4. Incomplete rows are unranked. */
function withRanks(rows: { dayTotal: string; complete: boolean }[]) {
  let rank = 0;
  let previous: number | null = null;
  return rows.map((row, index) => {
    if (!row.complete) return null;
    const score = Number(row.dayTotal);
    if (previous === null || score !== previous) {
      rank = index + 1;
      previous = score;
    }
    return rank;
  });
}

/** "Problem Understanding" -> "PU". */
function initials(label: string) {
  return label
    .split(" ")
    .map((word) => word[0])
    .join("");
}

/** A mean that may not exist yet: a panel type nobody has scored. */
function mark(value: string | null) {
  return value === null ? "|" : Number(value).toFixed(1);
}

export default async function PanelLeaderboardPage({
  params,
}: PageProps<"/panel/[round]/leaderboard">) {
  const { round: slug } = await params;
  const view = await getPanelLeaderboardView(slug);
  if (!view.round) notFound();

  const ranks = withRanks(view.rows);
  const [risk] = PANEL_TYPES.risk.criteria;

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[1100px] gap-10">
        <header>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            {view.round.name}
          </p>
          <h1 className="mt-2 font-serif text-5xl leading-none tracking-[-0.03em]">
            Leaderboard
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            {PANEL_TYPES.main.label}&apos;s average per criterion, out of{" "}
            {panelMax("main")}, plus {PANEL_TYPES.risk.label}&apos;s{" "}
            {risk.label} average, out of {panelMax("risk")}: {DAY_MAX} for the
            day. Live | no waiting for the event to open. A team still waiting
            on one panel is marked incomplete and listed last.
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
                  <th scope="col" className="w-14 px-4 py-4 font-normal">
                    #
                  </th>
                  <th scope="col" className="px-4 py-4 font-normal">
                    Team
                  </th>
                  <th scope="col" className="px-4 py-4 font-normal">
                    Track
                  </th>
                  <th scope="col" className="px-4 py-4 text-right font-normal">
                    <abbr
                      title={`Judges: ${PANEL_TYPES.main.label} · ${PANEL_TYPES.risk.label}`}
                    >
                      Judges
                    </abbr>
                  </th>
                  {PANEL_TYPES.main.criteria.map((criterion) => (
                    <th
                      key={criterion.key}
                      scope="col"
                      className="px-4 py-4 text-right font-normal"
                    >
                      {/* Full label in the accessible name, initials on screen. */}
                      <abbr title={`${criterion.label} / ${criterion.max}`}>
                        {initials(criterion.label)}
                      </abbr>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-right font-normal"
                  >
                    <abbr
                      title={`${PANEL_TYPES.main.label} / ${panelMax("main")}`}
                    >
                      T1 / {panelMax("main")}
                    </abbr>
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-right font-normal"
                  >
                    <abbr
                      title={`${PANEL_TYPES.risk.label}: ${risk.label} / ${risk.max}`}
                    >
                      {initials(risk.label)} / {risk.max}
                    </abbr>
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-4 py-4 text-right font-normal"
                  >
                    Day / {DAY_MAX}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row, index) => (
                  <tr
                    key={row.teamId}
                    className={cn(
                      "border-foreground/10 border-b last:border-b-0",
                      !row.complete && "text-muted-foreground",
                    )}
                  >
                    <td className="px-4 py-4 tabular-nums">
                      {ranks[index] ?? "|"}
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {row.teamName}
                      {row.complete ? null : (
                        <Badge
                          variant="outline"
                          className="ml-2 font-normal text-muted-foreground"
                        >
                          incomplete
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {row.trackName ? (
                        <Badge variant="outline">{row.trackName}</Badge>
                      ) : (
                        <span className="text-muted-foreground">|</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                      {row.mainJudges} · {row.riskJudges}
                    </td>
                    {PANEL_TYPES.main.criteria.map((criterion) => (
                      <td
                        key={criterion.key}
                        className="px-4 py-4 text-right text-muted-foreground tabular-nums"
                      >
                        {mark(row[criterion.key])}
                      </td>
                    ))}
                    <td className="px-4 py-4 text-right tabular-nums">
                      {mark(row.mainTotal)}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      {mark(row.riskTotal)}
                    </td>
                    <td className="px-4 py-4 text-right font-medium tabular-nums">
                      {Number(row.dayTotal).toFixed(1)}
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
