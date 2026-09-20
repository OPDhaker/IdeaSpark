"use client";

import { Check, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { upsertScore } from "@/actions/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SCORE_CRITERIA, SCORE_MAX } from "@/db/schema";
import { cn } from "@/lib/utils";

type PeerScore = {
  evaluatorId: string;
  evaluatorName: string;
  problemUnderstanding: string;
  ideaFeasibility: string;
  decisionMaking: string;
  coordination: string;
  score: string | null;
  remarks: string | null;
};

type Draft = Record<(typeof SCORE_CRITERIA)[number]["key"], string>;

const EMPTY: Draft = {
  problemUnderstanding: "",
  ideaFeasibility: "",
  decisionMaking: "",
  coordination: "",
};

function toDraft(score: PeerScore | null): Draft {
  if (!score) return EMPTY;
  return {
    // The database hands back `13.00`; a judge typed `13`. Strip the trailing
    // zeros so reopening a saved sheet shows what was entered.
    problemUnderstanding: String(Number(score.problemUnderstanding)),
    ideaFeasibility: String(Number(score.ideaFeasibility)),
    decisionMaking: String(Number(score.decisionMaking)),
    coordination: String(Number(score.coordination)),
  };
}

export function ScoreSheet({
  roundId,
  teamId,
  teamName,
  myScore,
  peerScores,
  canScore,
  panelName,
}: {
  roundId: string;
  teamId: string;
  teamName: string;
  myScore: PeerScore | null;
  /** Every other judge on the panel who has scored this team. */
  peerScores: PeerScore[];
  /**
   * False when the viewer is not on this team's panel — a super admin looking
   * in. The form renders read-only rather than disappearing, because seeing
   * the rubric behind a number is the point of looking.
   */
  canScore: boolean;
  /** The panel that owns this team, for the read-only explanation. */
  panelName: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(myScore));
  const [remarks, setRemarks] = useState(myScore?.remarks ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Prev/next swaps the team under a mounted form, so the draft has to follow
  // the team rather than only the first render.
  useEffect(() => {
    setDraft(toDraft(myScore));
    setRemarks(myScore?.remarks ?? "");
    setSaved(false);
    setError("");
  }, [myScore]);

  const values = SCORE_CRITERIA.map((criterion) => ({
    ...criterion,
    raw: draft[criterion.key],
    value: Number(draft[criterion.key]),
  }));

  const complete = values.every(
    (v) => v.raw.trim() !== "" && Number.isFinite(v.value),
  );
  const inRange = values.every((v) => v.value >= 0 && v.value <= v.max);
  const total = complete ? values.reduce((sum, v) => sum + v.value, 0) : null;

  async function save() {
    if (!canScore || !complete || !inRange) return;
    setPending(true);
    setError("");
    try {
      await upsertScore({
        roundId,
        teamId,
        problemUnderstanding: Number(draft.problemUnderstanding),
        ideaFeasibility: Number(draft.ideaFeasibility),
        decisionMaking: Number(draft.decisionMaking),
        coordination: Number(draft.coordination),
        remarks,
      });
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="grid gap-5">
          {values.map((criterion) => {
            const over =
              criterion.raw !== "" && criterion.value > criterion.max;
            return (
              <div key={criterion.key} className="grid gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  <Label htmlFor={criterion.key}>{criterion.label}</Label>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    out of {criterion.max}
                  </span>
                </div>
                <Input
                  id={criterion.key}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={criterion.max}
                  step="0.5"
                  value={criterion.raw}
                  aria-invalid={over}
                  readOnly={!canScore}
                  disabled={!canScore}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [criterion.key]: event.target.value,
                    }))
                  }
                  className="tabular-nums"
                />
                {over ? (
                  <p className="text-destructive text-xs">
                    {criterion.label} tops out at {criterion.max}.
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="remarks">
            Remarks <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="remarks"
            rows={4}
            value={remarks}
            readOnly={!canScore}
            disabled={!canScore}
            placeholder={
              canScore ? `What stood out about ${teamName}?` : "No remarks"
            }
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-foreground/15 border-t pt-5">
          <p className="font-serif text-3xl tabular-nums">
            {total === null ? "—" : total}
            <span className="ml-1 text-muted-foreground text-base">
              / {SCORE_MAX}
            </span>
          </p>
          <div className="flex items-center gap-3">
            {saved ? (
              <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Check aria-hidden className="size-4" />
                Saved
              </span>
            ) : null}
            {/*
              All four criteria are required: `scores.score` is generated from
              them, so a partial sheet has no total to rank on.
            */}
            <Button
              type="submit"
              disabled={!canScore || !complete || !inRange || pending}
            >
              {pending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {myScore ? "Update score" : "Save score"}
            </Button>
          </div>
        </div>

        {canScore && !complete ? (
          <p className="text-muted-foreground text-xs">
            Fill all four criteria to save.
          </p>
        ) : null}
        {!canScore ? (
          <p className="flex items-start gap-2 text-muted-foreground text-xs">
            <Eye aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Read-only.{" "}
            {panelName
              ? `${panelName} scores this team.`
              : "No panel has been assigned this team."}{" "}
            You can see the scores but not change them.
          </p>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>

      <aside className="grid content-start gap-4">
        <h2 className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
          {canScore ? "Your panel" : (panelName ?? "Scores")}
        </h2>
        {peerScores.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {canScore
              ? `No other judge has scored ${teamName} yet.`
              : `Nobody has scored ${teamName} yet.`}
          </p>
        ) : (
          <ul className="grid gap-3">
            {peerScores.map((peer) => (
              <li
                key={peer.evaluatorId}
                className="rounded-md border border-foreground/15 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium text-sm">
                    {peer.evaluatorName}
                  </p>
                  <p className="tabular-nums">
                    {Number(peer.score ?? 0)}
                    <span className="text-muted-foreground text-xs">
                      {" "}
                      / {SCORE_MAX}
                    </span>
                  </p>
                </div>
                <dl className="mt-3 grid gap-1 text-xs">
                  {SCORE_CRITERIA.map((criterion) => (
                    <div
                      key={criterion.key}
                      className="flex justify-between gap-3"
                    >
                      <dt className="text-muted-foreground">
                        {criterion.label}
                      </dt>
                      <dd className="tabular-nums">
                        {Number(peer[criterion.key])} / {criterion.max}
                      </dd>
                    </div>
                  ))}
                </dl>
                {peer.remarks ? (
                  <p
                    className={cn(
                      "mt-3 border-foreground/10 border-t pt-3",
                      "text-muted-foreground text-xs",
                    )}
                  >
                    {peer.remarks}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
