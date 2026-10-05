"use client";

import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { setTeamProgress } from "@/actions/team-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  TEAM_PROGRESS,
  TEAM_PROGRESS_KEYS,
  type TeamProgress,
} from "@/db/schema";
import { cn } from "@/lib/utils";

type Row = {
  teamId: string;
  teamName: string;
  trackName: string | null;
  panelId: string | null;
  panelName: string | null;
  status: TeamProgress;
};

type Sort = "panel" | "team" | "track";

/** Filter key for teams with no Type 1 panel yet. */
const UNASSIGNED = "none";
const STORAGE_KEY = "team-panels:panels";

const panelKey = (row: Row) => row.panelId ?? UNASSIGNED;

/** The selected segment's look. Unselected segments stay plain. */
const PROGRESS_ON: Record<TeamProgress, string> = {
  todo: "bg-background text-foreground shadow-xs",
  ongoing: "bg-chart-3 text-white shadow-xs",
  done: "bg-primary text-primary-foreground shadow-xs",
};

/**
 * Three-way To be done | Ongoing | Done switch. Full width with thumb-sized
 * segments on a phone, compact beside the row on a wide screen.
 */
function ProgressControl({
  teamName,
  status,
  onChange,
}: {
  teamName: string;
  status: TeamProgress;
  onChange: (status: TeamProgress) => void;
}) {
  return (
    <fieldset
      aria-label={`Progress for ${teamName}`}
      className="flex w-full min-w-0 rounded-md bg-muted p-1 lg:w-auto"
    >
      {TEAM_PROGRESS_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={status === key}
          onClick={() => status !== key && onChange(key)}
          className={cn(
            "h-10 flex-1 whitespace-nowrap rounded-sm px-2 font-medium text-muted-foreground text-sm transition-colors lg:h-8 lg:flex-none lg:px-3 lg:text-xs",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            status === key ? PROGRESS_ON[key] : "hover:text-foreground",
          )}
        >
          {TEAM_PROGRESS[key]}
        </button>
      ))}
    </fieldset>
  );
}

function secondsSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

/**
 * "Updated 4s ago". Rendered after mount only: the server's clock and the
 * phone's disagree, so a server-rendered number would mismatch on hydration.
 */
function UpdatedAgo({ fetchedAt }: { fetchedAt: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    setSeconds(secondsSince(fetchedAt));
    const timer = setInterval(() => setSeconds(secondsSince(fetchedAt)), 1000);
    return () => clearInterval(timer);
  }, [fetchedAt]);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {seconds === null
        ? "Live"
        : seconds < 5
          ? "Updated just now"
          : `Updated ${seconds}s ago`}
    </span>
  );
}

/**
 * Splits already-sorted rows into headed groups. `team` sort is one group
 * with no header: a flat A-Z list.
 */
function groupRows(rows: Row[], sort: Sort) {
  if (sort === "team") return [{ key: "all", title: null, rows }];

  const label = (row: Row) =>
    sort === "panel"
      ? (row.panelName ?? "Not assigned")
      : (row.trackName ?? "No track");
  // Missing values sort last, under their own header.
  const missing = (row: Row) =>
    sort === "panel" ? !row.panelName : !row.trackName;

  const sorted = [...rows].sort(
    (a, b) =>
      Number(missing(a)) - Number(missing(b)) ||
      label(a).localeCompare(label(b)) ||
      a.teamName.localeCompare(b.teamName),
  );

  const groups: Array<{ key: string; title: string; rows: Row[] }> = [];
  for (const row of sorted) {
    const title = label(row);
    const last = groups.at(-1);
    if (last?.title === title) last.rows.push(row);
    else groups.push({ key: title, title, rows: [row] });
  }
  return groups;
}

export function TeamPanelList({
  rows,
  rounds,
  roundId,
  roundSlug,
  initialPanels,
  fetchedAt,
}: {
  rows: Row[];
  rounds: Array<{ slug: string; name: string }>;
  roundId: string;
  roundSlug: string;
  /** From `?panel=`; `null` when the URL names none, so storage may fill in. */
  initialPanels: string[] | null;
  fetchedAt: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("panel");
  const [picked, setPicked] = useState<string[]>(initialPanels ?? []);

  // The tap shows at once; the action's revalidation then hands back the real
  // rows (including other volunteers' marks), and a failure falls back to them.
  const [shown, markOptimistic] = useOptimistic(
    rows,
    (current, change: { teamId: string; status: TeamProgress }) =>
      current.map((row) =>
        row.teamId === change.teamId ? { ...row, status: change.status } : row,
      ),
  );
  const [, startTransition] = useTransition();

  function changeProgress(row: Row, status: TeamProgress) {
    startTransition(async () => {
      markOptimistic({ teamId: row.teamId, status });
      try {
        await setTeamProgress({ teamId: row.teamId, roundId, status });
      } catch {
        toast.error(`Could not update ${row.teamName}. Try again.`);
      }
    });
  }

  // A volunteer opening the page from the sidebar has no `?panel=`, so bring
  // back the panels they ticked last time on this device.
  useEffect(() => {
    if (initialPanels !== null) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved) && saved.length > 0) {
        setPicked(saved.filter((id) => typeof id === "string"));
      }
    } catch {
      // Storage blocked or corrupt: start from every panel.
    }
  }, [initialPanels]);

  function choosePanels(next: string[]) {
    setPicked(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Private mode: the URL below still carries the choice.
    }
    const params = new URLSearchParams(window.location.search);
    params.delete("panel");
    for (const id of next) params.append("panel", id);
    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      search ? `?${search}` : window.location.pathname,
    );
  }

  // Options come from this round's rows. A saved panel that holds no team
  // this round stays saved but is ignored, so it returns in the next round.
  const options = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const key = panelKey(row);
    const option = options.get(key) ?? {
      name: row.panelName ?? "Not assigned",
      count: 0,
    };
    option.count += 1;
    options.set(key, option);
  }
  const panelOptions = [...options.entries()].sort(
    ([a, x], [b, y]) =>
      Number(a === UNASSIGNED) - Number(b === UNASSIGNED) ||
      x.name.localeCompare(y.name),
  );
  const active = picked.filter((id) => options.has(id));

  const needle = query.trim().toLowerCase();
  const visible = shown.filter(
    (row) =>
      (active.length === 0 || active.includes(panelKey(row))) &&
      (!needle ||
        [row.teamName, row.trackName, row.panelName].some((value) =>
          value?.toLowerCase().includes(needle),
        )),
  );
  const unassigned = rows.filter((row) => !row.panelId).length;
  const groups = groupRows(visible, sort);
  const progressCounts = TEAM_PROGRESS_KEYS.map(
    (key) =>
      `${visible.filter((row) => row.status === key).length} ${TEAM_PROGRESS[key].toLowerCase()}`,
  ).join(" | ");

  const triggerLabel =
    active.length === 0
      ? "All panels"
      : active.length === 1
        ? (options.get(active[0])?.name ?? "1 panel")
        : `${active.length} panels`;

  const roundHref = (slug: string) => {
    const params = new URLSearchParams({ round: slug });
    for (const id of picked) params.append("panel", id);
    return `/admin/team-panels?${params}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {rounds.length > 1 ? (
        <nav aria-label="Round" className="flex flex-wrap gap-2">
          {rounds.map((round) => (
            <Link
              key={round.slug}
              href={roundHref(round.slug)}
              aria-current={round.slug === roundSlug ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                round.slug === roundSlug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground/15 hover:bg-accent",
              )}
            >
              {round.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_auto_10rem]">
        <div className="relative col-span-2 md:col-span-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search team, track or panel"
            aria-label="Search teams"
            className="h-11 pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-11 w-full justify-between gap-2 md:min-w-44"
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronDown aria-hidden className="size-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Your panels</DropdownMenuLabel>
            {panelOptions.map(([key, option]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={active.includes(key)}
                // Keep the menu open so several panels can be ticked in a row.
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) =>
                  choosePanels(
                    checked
                      ? [...active, key]
                      : active.filter((id) => id !== key),
                  )
                }
              >
                <span className="flex-1 truncate">{option.name}</span>
                <span className="text-muted-foreground text-xs">
                  {option.count}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            {active.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => choosePanels([])}>
                  Show all panels
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <NativeSelect
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
          aria-label="Sort by"
          className="h-11"
        >
          <NativeSelectOption value="panel">By panel</NativeSelectOption>
          <NativeSelectOption value="track">By track</NativeSelectOption>
          <NativeSelectOption value="team">Team A-Z</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
        <span>
          {visible.length === rows.length
            ? `${rows.length} teams`
            : `${visible.length} of ${rows.length} teams`}
          {unassigned > 0 ? ` | ${unassigned} not assigned` : null}
          <br />
          {progressCounts}
        </span>
        <UpdatedAgo fetchedAt={fetchedAt} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">
          No teams in this round yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">
          {needle
            ? `No team matches “${query.trim()}”.`
            : "No teams on the selected panels."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-foreground/15">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_auto] gap-4 border-foreground/15 border-b bg-muted/40 px-4 py-2 font-medium text-muted-foreground text-xs lg:grid">
            <span>Team</span>
            <span>Track</span>
            <span>Panel</span>
            <span>Progress</span>
          </div>
          {groups.map((group) => (
            <section key={group.key} aria-label={group.title ?? undefined}>
              {group.title ? (
                <h2 className="flex items-baseline justify-between gap-2 border-foreground/10 border-b bg-muted/20 px-4 py-2 font-medium text-sm">
                  <span className="truncate">{group.title}</span>
                  <span className="shrink-0 font-normal text-muted-foreground text-xs">
                    {group.rows.length}{" "}
                    {group.rows.length === 1 ? "team" : "teams"}
                  </span>
                </h2>
              ) : null}
              <ul className="divide-y divide-foreground/10">
                {group.rows.map((row) => (
                  <li
                    key={row.teamId}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {row.teamName}
                    </span>
                    <span className="col-start-1 row-start-2 min-w-0 truncate text-muted-foreground text-sm lg:col-start-auto lg:row-start-auto">
                      {row.trackName ?? "No track"}
                    </span>
                    <span className="col-start-2 row-span-2 row-start-1 justify-self-end lg:col-start-auto lg:row-span-1 lg:row-start-auto lg:justify-self-start">
                      {row.panelName ? (
                        <Badge className="max-w-40 truncate text-sm">
                          {row.panelName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Not assigned
                        </span>
                      )}
                    </span>
                    <div className="col-span-2 row-start-3 mt-2 lg:col-span-1 lg:row-start-auto lg:mt-0">
                      <ProgressControl
                        teamName={row.teamName}
                        status={row.status}
                        onChange={(status) => changeProgress(row, status)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
