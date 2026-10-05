"use client";

import { Loader2, Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { setRoundScoringClosed } from "@/actions/panel";
import { Button } from "@/components/ui/button";

type Round = { id: string; name: string; scoringClosed: boolean };

/**
 * Closes a round's scoring once it is judged. Like the other switches here,
 * each button says what it will do.
 */
export function ScoringToggle({ rounds }: { rounds: Round[] }) {
  const [pending, setPending] = useState<string | undefined>();
  const [error, setError] = useState("");

  async function set(round: Round) {
    setPending(round.id);
    setError("");
    try {
      await setRoundScoringClosed(round.id, !round.scoringClosed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(undefined);
    }
  }

  return (
    <div className="rounded-md border border-foreground/15 p-6">
      <div className="max-w-prose">
        <h2 className="flex items-center gap-2 font-medium">
          <Lock aria-hidden className="size-4" />
          Scoring
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Close a round once it is judged. Judges can still see every score, but
          nobody can save or change one.
        </p>
      </div>

      <ul className="mt-5 grid gap-3">
        {rounds.map((round) => (
          <li
            key={round.id}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <p className="text-sm">
              <span className="font-medium">{round.name}</span>
              <span className="text-muted-foreground">
                {" | "}
                {round.scoringClosed ? "Closed, scores final" : "Open"}
              </span>
            </p>
            <Button
              onClick={() => set(round)}
              disabled={pending !== undefined}
              variant={round.scoringClosed ? "outline" : "default"}
            >
              {pending === round.id ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : round.scoringClosed ? (
                <LockOpen aria-hidden className="size-4" />
              ) : (
                <Lock aria-hidden className="size-4" />
              )}
              {round.scoringClosed ? "Reopen scoring" : "Close scoring"}
            </Button>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-4 text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
