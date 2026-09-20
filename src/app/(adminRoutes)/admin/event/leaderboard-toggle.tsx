"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setLeaderboardPublished } from "@/app/actions";
import { Button } from "@/components/ui/button";

/**
 * Publishing is outward-facing to every team at once, so the button states
 * what will happen rather than showing a switch whose direction has to be
 * inferred.
 */
export function LeaderboardToggle({ published }: { published: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setPending(true);
    setError("");
    try {
      await setLeaderboardPublished(!published);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border border-foreground/15 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-prose">
          <h2 className="flex items-center gap-2 font-medium">
            {published ? (
              <Eye aria-hidden className="size-4" />
            ) : (
              <EyeOff aria-hidden className="size-4" />
            )}
            Team leaderboard
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            {published
              ? "Visible. Every registered team can see the board and where they rank right now."
              : "Hidden. Teams see a locked row in their sidebar, and the page refuses them if they guess the URL."}
          </p>
          <p className="mt-3 text-muted-foreground text-xs">
            Judges keep their own board at /panel either way — this only
            controls what teams see. Publish once judging is finished, not while
            it runs: scores arrive one judge at a time.
          </p>
        </div>

        <Button
          onClick={toggle}
          disabled={pending}
          variant={published ? "outline" : "default"}
        >
          {pending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : null}
          {published ? "Hide from teams" : "Publish to teams"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
