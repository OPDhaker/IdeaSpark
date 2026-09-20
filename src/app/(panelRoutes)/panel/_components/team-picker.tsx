"use client";

import { Check, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type QueueEntry = {
  id: string;
  teamName: string;
  trackName: string | null;
  scoredByMe: boolean;
};

/**
 * The queue, with a filter over it.
 *
 * Filtering is client-side on purpose: the list is one panel's teams for one
 * day, so it is small, and a judge reading a team name off a badge gets results
 * as they type rather than a round trip per keystroke.
 */
export function TeamPicker({
  slug,
  teams,
  currentId,
}: {
  slug: string;
  teams: QueueEntry[];
  currentId: string | null;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? teams.filter((team) => team.teamName.toLowerCase().includes(needle))
    : teams;

  const scored = teams.filter((team) => team.scoredByMe).length;

  return (
    <div className="grid content-start gap-4">
      <div className="grid gap-2">
        <div className="relative">
          <Search
            aria-hidden
            className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams"
            aria-label="Search teams"
            className="pl-9"
          />
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {scored} of {teams.length} scored by you
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No team matches “{query}”.
        </p>
      ) : (
        <ul className="grid gap-1">
          {visible.map((team) => (
            <li key={team.id}>
              <Link
                href={`/panel/${slug}?team=${team.id}`}
                aria-current={team.id === currentId ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  team.id === currentId &&
                    "bg-accent font-medium text-accent-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{team.teamName}</span>
                {team.scoredByMe ? (
                  <Check
                    aria-label="Scored by you"
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
