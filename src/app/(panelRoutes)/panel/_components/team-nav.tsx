"use client";

import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Neighbour = { id: string; teamName: string } | null;

/**
 * Prev/next walk the queue in team-name order and skip nothing, so a judge's
 * place in the list never moves under their hand as they save. Jumping past
 * the teams they have already done is a separate, deliberate button.
 */
export function TeamNav({
  slug,
  teamName,
  position,
  total,
  previous,
  next,
  nextUnscored,
  scoredByMe,
}: {
  slug: string;
  teamName: string;
  /** Zero-based index in the queue; rendered one-based. */
  position: number;
  total: number;
  previous: Neighbour;
  next: Neighbour;
  nextUnscored: Neighbour;
  scoredByMe: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Button
          asChild={Boolean(previous)}
          variant="outline"
          size="icon"
          disabled={!previous}
          aria-label="Previous team"
        >
          {previous ? (
            <Link href={`/panel/${slug}?team=${previous.id}`}>
              <ChevronLeft aria-hidden />
            </Link>
          ) : (
            <ChevronLeft aria-hidden />
          )}
        </Button>

        <div className="min-w-0">
          <h1 className="truncate font-serif text-3xl leading-none tracking-[-0.03em]">
            {teamName}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-muted-foreground text-xs">
            <span className="tabular-nums">
              {position + 1} of {total}
            </span>
            {scoredByMe ? (
              <Badge variant="outline" className="gap-1">
                <Check aria-hidden className="size-3" />
                Scored by you
              </Badge>
            ) : null}
          </p>
        </div>

        <Button
          asChild={Boolean(next)}
          variant="outline"
          size="icon"
          disabled={!next}
          aria-label="Next team"
        >
          {next ? (
            <Link href={`/panel/${slug}?team=${next.id}`}>
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <ChevronRight aria-hidden />
          )}
        </Button>
      </div>

      {nextUnscored ? (
        <Button asChild variant="ghost">
          <Link href={`/panel/${slug}?team=${nextUnscored.id}`}>
            Next unscored
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
