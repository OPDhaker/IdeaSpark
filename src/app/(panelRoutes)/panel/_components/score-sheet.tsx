"use client";

import { Check, Eye, Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { upsertScore } from "@/actions/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PANEL_TYPES,
  type PanelType,
  panelMax,
  type ScoreCriterionKey,
} from "@/db/schema";
import { cn } from "@/lib/utils";

type PeerScore = {
  evaluatorId: string;
  evaluatorName: string;
  panelType: PanelType;
  problemUnderstanding: string | null;
  ideaFeasibility: string | null;
  decisionMaking: string | null;
  coordination: string | null;
  riskManagement: string | null;
  score: string | null;
  remarks: string | null;
};

type Draft = Partial<Record<ScoreCriterionKey, string>>;

function toDraft(panelType: PanelType, score: PeerScore | null): Draft {
  return Object.fromEntries(
    PANEL_TYPES[panelType].criteria.map(({ key }) => {
      const saved = score?.[key];
      // The database hands back `13.00`; a judge typed `13`. Strip the
      // trailing zeros so reopening a saved sheet shows what was entered.
      return [key, saved == null ? "" : String(Number(saved))];
    }),
  );
}

export function ScoreSheet({
  roundId,
  teamId,
  teamName,
  panelType,
  myScore,
  peerScores,
  canScore,
  closed,
  panelName,
}: {
  roundId: string;
  teamId: string;
  teamName: string;
  /** Which half of the rubric this sheet scores. */
  panelType: PanelType;
  myScore: PeerScore | null;
  /** Every other judge on the panel who has scored this team. */
  peerScores: PeerScore[];
  /**
   * False when the viewer is not on this team's panel — a super admin looking
   * in. The form renders read-only rather than disappearing, because seeing
   * the rubric behind a number is the point of looking.
   */
  canScore: boolean;
  /** The round's scoring is closed: every score in it is final. */
  closed: boolean;
  /** The panel that owns this team, for the read-only explanation. */
  panelName: string | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(panelType, myScore));
  const [remarks, setRemarks] = useState(myScore?.remarks ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Prev/next swaps the team under a mounted form, so the draft has to follow
  // the team rather than only the first render.
  useEffect(() => {
    setDraft(toDraft(panelType, myScore));
    setRemarks(myScore?.remarks ?? "");
    setSaved(false);
    setError("");
  }, [panelType, myScore]);

  const editable = canScore && !closed;
  const criteria = PANEL_TYPES[panelType].criteria;
  const max = panelMax(panelType);
  const values = criteria.map((criterion) => ({
    ...criterion,
    raw: draft[criterion.key] ?? "",
    value: Number(draft[criterion.key]),
  }));

  const complete = values.every(
    (v) => v.raw.trim() !== "" && Number.isFinite(v.value),
  );
  const inRange = values.every((v) => v.value >= 0 && v.value <= v.max);
  const total = complete ? values.reduce((sum, v) => sum + v.value, 0) : null;

  async function save() {
    if (!editable || !complete || !inRange) return;
    setPending(true);
    setError("");
    try {
      await upsertScore({
        roundId,
        teamId,
        criteria: Object.fromEntries(values.map((v) => [v.key, v.value])),
        remarks,
      });
      setSaved(true);
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
                  readOnly={!editable}
                  disabled={!editable}
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
            readOnly={!editable}
            disabled={!editable}
            placeholder={
              editable ? `What stood out about ${teamName}?` : "No remarks"
            }
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-foreground/15 border-t pt-5">
          <p className="font-serif text-3xl tabular-nums">
            {total === null ? "—" : total}
            <span className="ml-1 text-muted-foreground text-base">
              / {max}
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
              Every criterion on the sheet is required: `scores_shape` refuses a
              partial row, and a partial sheet has no total to rank on.
            */}
            <Button
              type="submit"
              disabled={!editable || !complete || !inRange || pending}
            >
              {pending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              {myScore ? "Update score" : "Save score"}
            </Button>
          </div>
        </div>

        {editable && !complete ? (
          <p className="text-muted-foreground text-xs">
            {criteria.length === 1
              ? `Fill ${criteria[0].label} to save.`
              : `Fill all ${criteria.length} criteria to save.`}
          </p>
        ) : null}
        {closed ? (
          <p className="flex items-start gap-2 text-muted-foreground text-xs">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Scoring for this round is closed. Scores are final.
          </p>
        ) : !canScore ? (
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
                      / {panelMax(peer.panelType)}
                    </span>
                  </p>
                </div>
                {/* Each peer card reads its own type: the "every team" view mixes both. */}
                {peer.panelType !== panelType ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    {PANEL_TYPES[peer.panelType].label}
                  </p>
                ) : null}
                <dl className="mt-3 grid gap-1 text-xs">
                  {PANEL_TYPES[peer.panelType].criteria.map((criterion) => (
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
