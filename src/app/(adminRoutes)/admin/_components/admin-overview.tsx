"use client";

import {
  CircleCheck,
  CircleX,
  FileClock,
  Hourglass,
  type LucideIcon,
  Send,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  type TeamCounts,
  type TeamFilters,
  type TrackRow,
} from "../_lib/team-filters";

type Card = {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Applied on top of the defaults, so a card always means exactly this. */
  filter: Partial<TeamFilters>;
  tone?: "warn";
};

function matches(filters: TeamFilters, card: Partial<TeamFilters>) {
  const target = { ...DEFAULT_FILTERS, ...card, query: filters.query };
  return (Object.keys(target) as Array<keyof TeamFilters>).every(
    (key) => filters[key] === target[key],
  );
}

export function AdminOverview({
  counts,
  trackRows,
  filters,
  onApply,
}: {
  counts: TeamCounts;
  trackRows: TrackRow[];
  filters: TeamFilters;
  onApply: (filter: Partial<TeamFilters>) => void;
}) {
  const cards: Card[] = [
    { label: "Teams", value: counts.total, icon: Users, filter: {} },
    {
      label: "Submitted",
      value: counts.submitted,
      icon: Send,
      filter: { submission: "submitted" },
    },
    {
      label: "Not submitted",
      value: counts.notSubmitted,
      icon: FileClock,
      filter: { submission: "not_submitted" },
    },
    {
      label: "In review",
      value: counts.inReview,
      icon: Hourglass,
      filter: { decision: "in_review" },
    },
    {
      label: "Accepted",
      value: counts.accepted,
      icon: CircleCheck,
      filter: { decision: "accepted" },
    },
    {
      label: "Rejected",
      value: counts.rejected,
      icon: CircleX,
      filter: { decision: "rejected" },
    },
    {
      label: "Paid",
      value: counts.paid,
      icon: Wallet,
      filter: { payment: "paid" },
    },
    {
      label: "Accepted | unpaid",
      value: counts.acceptedUnpaid,
      icon: TriangleAlert,
      filter: { decision: "accepted", payment: "unpaid" },
      tone: "warn",
    },
  ];

  return (
    <section aria-label="At a glance" className="mt-6 grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {cards.map((card) => {
          const active = matches(filters, card.filter);
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              aria-pressed={active}
              onClick={() => onApply(card.filter)}
              className={cn(
                "flex flex-col gap-2 border bg-card p-3 text-left transition-colors hover:border-primary/60",
                active ? "border-primary ring-1 ring-primary" : "border-border",
              )}
            >
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Icon
                  className={cn(
                    "size-[14px]",
                    card.tone === "warn" && card.value > 0
                      ? "text-destructive"
                      : "text-primary",
                  )}
                />
                {card.label}
              </span>
              <span className="font-semibold text-2xl tabular-nums tracking-[-0.03em]">
                {card.value}
              </span>
            </button>
          );
        })}
      </div>

      {trackRows.length > 0 && (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-border border-b text-left text-muted-foreground text-xs">
                <th className="px-3 py-2 font-medium">Track</th>
                <th className="px-3 py-2 text-right font-medium">Teams</th>
                <th className="px-3 py-2 text-right font-medium">Submitted</th>
                <th className="px-3 py-2 text-right font-medium">Accepted</th>
                <th className="px-3 py-2 text-right font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {trackRows.map((row) => {
                const active = filters.trackId === row.trackId;
                return (
                  <tr
                    key={row.trackId}
                    className={cn(
                      "border-border border-b last:border-b-0",
                      active && "bg-accent/50",
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          onApply({ trackId: active ? "all" : row.trackId })
                        }
                        className="text-left font-medium hover:text-primary hover:underline"
                      >
                        {row.name}
                      </button>
                      {!row.isActive && (
                        <span className="ml-2 text-muted-foreground text-xs">
                          inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.teams}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.submitted}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.accepted}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.paid}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
