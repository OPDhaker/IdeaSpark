"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  assignTeamsToPanel,
  createPanel,
  deletePanel,
  type getPanelAdminData,
  setPanelJudges,
} from "@/actions/panel";

export type PanelAdminData = Awaited<ReturnType<typeof getPanelAdminData>>;

const UNASSIGNED = "";

export function PanelsAdmin({ data }: { data: PanelAdminData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPanel, setNewPanel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // The round lives in the URL, not in state: assignments are fetched per
  // round on the server, so switching has to go back through it.
  const roundId = data.round?.id ?? "";
  const round = data.round;

  function selectRound(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("round", next);
    router.push(`/admin/panels?${params.toString()}`);
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  const panelOf = new Map(
    data.assignments.map((row) => [row.teamId, row.panelId]),
  );
  const judgesOf = (panelId: string) =>
    data.judges.filter((judge) => judge.panelId === panelId);

  return (
    <section className="mt-10 border border-[#17201d]/15 bg-white p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">
            Judging panels
          </h2>
          <p className="mt-1 text-sm text-[#17201d]/60">
            A judge sits on one panel. A panel scores the teams assigned to it
            for a round, and the team&apos;s number is that panel&apos;s
            average.
          </p>
        </div>
        <label className="text-sm">
          Round
          <select
            value={roundId}
            onChange={(event) => selectRound(event.target.value)}
            className="mt-1 block border border-[#17201d]/20 bg-white px-3 py-2 text-sm"
          >
            {data.rounds.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.eventDate}
              </option>
            ))}
          </select>
        </label>
      </header>

      {(notice || error) && (
        <p
          className={`mt-4 border px-4 py-3 text-sm ${
            error
              ? "border-[#a24b3d] bg-[#fff1ed] text-[#8a352a]"
              : "border-[#73917a] bg-[#eaf2e9] text-[#315c38]"
          }`}
        >
          {error || notice}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#55705c]">
            Panels
          </h3>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newPanel.trim()) return;
              run(() => createPanel(newPanel), "Panel created.").then(() =>
                setNewPanel(""),
              );
            }}
          >
            <input
              value={newPanel}
              onChange={(event) => setNewPanel(event.target.value)}
              placeholder="Panel A"
              className="flex-1 border border-[#17201d]/20 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending || !newPanel.trim()}
              className="flex items-center gap-1.5 bg-[#17201d] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {pending ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Plus aria-hidden className="size-4" />
              )}
              Add
            </button>
          </form>

          <ul className="mt-4 space-y-4">
            {data.panels.map((panel) => {
              const members = judgesOf(panel.id);
              return (
                <li
                  key={panel.id}
                  className="border border-[#17201d]/15 bg-[#f7f6f3] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{panel.name}</p>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Delete ${panel.name}`}
                      onClick={() =>
                        run(() => deletePanel(panel.id), "Panel deleted.")
                      }
                      className="text-[#8a352a] disabled:opacity-50"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>

                  {/*
                    The roster is replaced wholesale, not diffed: a judge may
                    only be on one panel, so moving one has to fail loudly
                    rather than half-apply.
                  */}
                  <fieldset className="mt-3">
                    <legend className="text-xs text-[#17201d]/55">
                      Judges
                    </legend>
                    <div className="mt-2 grid gap-1.5">
                      {data.evaluators.map((evaluator) => {
                        const onThis = members.some(
                          (m) => m.adminId === evaluator.id,
                        );
                        const elsewhere = data.judges.find(
                          (j) =>
                            j.adminId === evaluator.id &&
                            j.panelId !== panel.id,
                        );
                        return (
                          <label
                            key={evaluator.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={onThis}
                              disabled={pending || Boolean(elsewhere)}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [
                                      ...members.map((m) => m.adminId),
                                      evaluator.id,
                                    ]
                                  : members
                                      .map((m) => m.adminId)
                                      .filter((id) => id !== evaluator.id);
                                run(
                                  () => setPanelJudges(panel.id, next),
                                  "Panel roster updated.",
                                );
                              }}
                            />
                            <span
                              className={elsewhere ? "text-[#17201d]/40" : ""}
                            >
                              {evaluator.name}
                              {elsewhere ? " · on another panel" : ""}
                            </span>
                          </label>
                        );
                      })}
                      {data.evaluators.length === 0 ? (
                        <p className="text-sm text-[#17201d]/55">
                          No evaluators exist yet. Add one under Admins first.
                        </p>
                      ) : null}
                    </div>
                  </fieldset>
                </li>
              );
            })}
            {data.panels.length === 0 ? (
              <li className="text-sm text-[#17201d]/55">No panels yet.</li>
            ) : null}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#55705c]">
            Teams · {round?.name ?? "no round"}
          </h3>
          <p className="mt-1 text-sm text-[#17201d]/55">
            Accepted and paid teams only. A team scores under exactly one panel
            per round.
          </p>

          <ul className="mt-4 divide-y divide-[#17201d]/10 border border-[#17201d]/15">
            {data.teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm">
                  {team.teamName}
                </span>
                <select
                  value={panelOf.get(team.id) ?? UNASSIGNED}
                  disabled={pending || !roundId}
                  onChange={(event) => {
                    const panelId = event.target.value;
                    if (!panelId) return;
                    run(
                      () => assignTeamsToPanel(roundId, panelId, [team.id]),
                      `${team.teamName} assigned.`,
                    );
                  }}
                  className="border border-[#17201d]/20 bg-white px-2 py-1.5 text-sm"
                >
                  <option value={UNASSIGNED}>Unassigned</option>
                  {data.panels.map((panel) => (
                    <option key={panel.id} value={panel.id}>
                      {panel.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
            {data.teams.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[#17201d]/55">
                No accepted, paid teams yet.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
