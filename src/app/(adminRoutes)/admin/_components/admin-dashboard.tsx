"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { recheckDriveLinks } from "@/actions/submissions";
import { reviewSubmission, setTeamStatus } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "../_lib/format";
import {
  DEFAULT_FILTERS,
  type TeamFilters as Filters,
  filterTeams,
  sortTeams,
  summarize,
  type TeamSort,
} from "../_lib/team-filters";
import { AdminOverview } from "./admin-overview";
import { DriveLinkStatus } from "./drive-link-status";
import { TeamFilters } from "./team-filters";

type ReviewData = {
  admin: {
    id: string;
    name: string;
    role: "super_admin" | "evaluator" | "volunteer";
  };
  teams: Array<{
    id: string;
    teamName: string;
    trackId: string | null;
    trackName: string | null;
    status: "pending_submission" | "in_review" | "rejected" | "accepted";
    paymentStatus: "unpaid" | "paid";
    paymentId: string | null;
    createdAt: Date;
  }>;
  tracks: Array<{ id: string; name: string; isActive: boolean }>;
  rounds: Array<{
    id: string;
    name: string;
    description: string | null;
    sequenceNo: number;
    isActive: boolean;
  }>;
  submissions: Array<{
    id: string;
    teamId: string;
    roundId: string;
    title: string | null;
    description: string | null;
    driveLink: string | null;
    driveLinkStatus: "public" | "restricted" | "unverified" | null;
    driveLinkName: string | null;
    driveLinkModifiedAt: Date | null;
    driveLinkCheckedAt: Date | null;
    status: "pending_submission" | "in_review" | "rejected" | "accepted";
    remarks: string | null;
    submittedAt: Date | null;
  }>;
  members: Array<{
    id: string;
    teamId: string;
    name: string;
    raNumber: string;
    netId: string;
    isLeader: boolean;
  }>;
  scores: Array<{
    id: string;
    teamId: string;
    roundId: string;
    evaluatorId: string;
    score: string | null;
    remarks: string | null;
  }>;
  submissionDeadline: Date | null;
};

const statusVariant = {
  pending_submission: "outline",
  in_review: "secondary",
  accepted: "default",
  rejected: "destructive",
} as const;

export function AdminDashboard({ data }: { data: ReviewData }) {
  const [selectedTeamId, setSelectedTeamId] = useState(data.teams[0]?.id ?? "");
  const [selectedRoundId, setSelectedRoundId] = useState(
    data.rounds.find((round) => round.isActive)?.id ?? data.rounds[0]?.id ?? "",
  );
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<TeamSort>("newest");
  const [remarks, setRemarks] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId);
  const selectedSubmission = data.submissions.find(
    (submission) =>
      submission.teamId === selectedTeamId &&
      submission.roundId === selectedRoundId,
  );
  // Teams whose deck for the selected round is known to be private, so the
  // list can flag them without opening each one.
  const privateLinkTeams = useMemo(
    () =>
      new Set(
        data.submissions
          .filter(
            (submission) =>
              submission.roundId === selectedRoundId &&
              submission.driveLinkStatus === "restricted",
          )
          .map((submission) => submission.teamId),
      ),
    [data.submissions, selectedRoundId],
  );
  const selectedMembers = data.members.filter(
    (member) => member.teamId === selectedTeamId,
  );
  const visibleTeams = useMemo(
    () => sortTeams(filterTeams(data.teams, filters), sort),
    [data.teams, filters, sort],
  );
  const summary = useMemo(
    () => summarize(data.teams, data.tracks),
    [data.teams, data.tracks],
  );

  // An overview card names one slice outright, so it replaces the other
  // filters rather than stacking on them. The search box is left alone.
  function applySlice(slice: Partial<Filters>) {
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      ...slice,
      query: current.query,
    }));
  }

  function clearFeedback() {
    setNotice("");
    setError("");
  }

  async function run(
    operation: () => Promise<unknown>,
    successMessage: string,
  ) {
    clearFeedback();
    setPending(true);
    try {
      await operation();
      setNotice(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleRecheck() {
    clearFeedback();
    setPending(true);
    try {
      const counts = await recheckDriveLinks(selectedRoundId);
      const parts = [
        `${counts.public} public`,
        `${counts.restricted} private`,
        counts.unverified && `${counts.unverified} unreachable`,
        counts.invalid && `${counts.invalid} not a deck link`,
      ].filter(Boolean);
      setNotice(`Links rechecked: ${parts.join(", ")}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recheck failed.");
    } finally {
      setPending(false);
    }
  }

  function handleReview(status: "accepted" | "rejected") {
    if (!selectedSubmission) return;
    return run(
      () => reviewSubmission(selectedSubmission.id, status, remarks),
      `Submission ${status}.`,
    );
  }

  // Teams and submissions share one lifecycle enum, so a team is `accepted`,
  // never `approved`. See `reviewStatusEnum` in src/db/schema.ts.
  function handleTeamStatus(
    status: "accepted" | "rejected" | "pending_submission",
  ) {
    if (!selectedTeam) return;
    return run(
      () => setTeamStatus(selectedTeam.id, status),
      `Team ${status.replaceAll("_", " ")}.`,
    );
  }

  const canReview = data.admin.role === "super_admin";
  const canScan =
    data.admin.role === "super_admin" || data.admin.role === "volunteer";

  return (
    <main className="min-h-dvh bg-[#f5f4f0] px-4 py-6 text-[#17201d] md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-3 border-b border-[#17201d]/15 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#55705c]">
              IdeaSpark control room
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
              Evaluate teams
            </h1>
          </div>
          <p className="text-sm text-[#17201d]/60">
            Signed in as {data.admin.name} · {data.admin.role.replace("_", " ")}
          </p>
        </header>

        {(notice || error) && (
          <div
            className={`mt-5 border px-4 py-3 text-sm ${error ? "border-[#a24b3d] bg-[#fff1ed] text-[#8a352a]" : "border-[#73917a] bg-[#eaf2e9] text-[#315c38]"}`}
          >
            {error || notice}
          </div>
        )}

        <AdminOverview
          counts={summary.counts}
          trackRows={summary.trackRows}
          filters={filters}
          onApply={applySlice}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Only the team list scrolls. The aside is pinned to the viewport on
              desktop (`self-start`, since a stretched grid item can't stick),
              so the team pane beside it rides the page scroll. */}
          <aside className="flex flex-col border border-[#17201d]/15 bg-white p-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Teams</h2>
              <span className="text-xs text-[#17201d]/50">
                {data.teams.length}
              </span>
            </div>
            <input
              value={filters.query}
              onChange={(event) =>
                setFilters({ ...filters, query: event.target.value })
              }
              placeholder="Search teams"
              className="mt-4 w-full border border-[#17201d]/20 px-3 py-2 text-sm outline-none focus:border-[#55705c]"
            />
            <TeamFilters
              filters={filters}
              sort={sort}
              tracks={data.tracks}
              shown={visibleTeams.length}
              total={data.teams.length}
              onChange={setFilters}
              onSort={setSort}
            />
            <div className="mt-4 max-h-[60dvh] min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain lg:max-h-none">
              {visibleTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full border-l-2 px-3 py-3 text-left ${selectedTeamId === team.id ? "border-[#55705c] bg-[#edf3ec]" : "border-transparent hover:bg-[#f5f4f0]"}`}
                >
                  <span className="block font-medium">{team.teamName}</span>
                  <span className="mt-1 block text-xs text-[#17201d]/55">
                    {team.trackName ?? "No track"}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant={statusVariant[team.status]}>
                      {team.status.replaceAll("_", " ")}
                    </Badge>
                    <Badge
                      variant={
                        team.paymentStatus === "paid" ? "default" : "outline"
                      }
                    >
                      {team.paymentStatus}
                    </Badge>
                    {privateLinkTeams.has(team.id) && (
                      <Badge variant="destructive">private link</Badge>
                    )}
                  </span>
                </button>
              ))}
              {!visibleTeams.length && (
                <p className="px-3 py-4 text-sm text-[#17201d]/55">
                  No matching teams.
                </p>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            {!selectedTeam ? (
              <div className="border border-dashed border-[#17201d]/20 p-10 text-center text-[#17201d]/60">
                Select a team to begin.
              </div>
            ) : (
              <>
                <div className="flex flex-col justify-between gap-4 border-b border-[#17201d]/15 pb-5 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm text-[#55705c]">
                      {selectedTeam.trackName ?? "Track not selected"}
                    </p>
                    <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">
                      {selectedTeam.teamName}
                    </h2>
                    <p className="mt-2 text-sm text-[#17201d]/60">
                      {selectedMembers.length} members · payment{" "}
                      {selectedTeam.paymentStatus ?? "unpaid"}
                    </p>
                    {selectedTeam.paymentId ? (
                      <p className="mt-1 break-all text-xs text-[#17201d]/60">
                        Payment ID: {selectedTeam.paymentId}
                      </p>
                    ) : null}
                  </div>
                  {canReview && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleTeamStatus("accepted")}
                        className="border border-[#55705c] px-3 py-2 text-sm text-[#315c38] disabled:opacity-50"
                      >
                        Approve team
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleTeamStatus("rejected")}
                        className="border border-[#a24b3d] px-3 py-2 text-sm text-[#8a352a] disabled:opacity-50"
                      >
                        Reject team
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-6">
                    <section className="border border-[#17201d]/15 bg-white p-5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <h3 className="text-lg font-semibold">
                            Submission review
                          </h3>
                          <p className="text-sm text-[#17201d]/55">
                            Review the selected round&apos;s idea.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={selectedRoundId}
                            onChange={(event) =>
                              setSelectedRoundId(event.target.value)
                            }
                            className="border border-[#17201d]/20 bg-white px-3 py-2 text-sm"
                          >
                            {data.rounds.map((round) => (
                              <option key={round.id} value={round.id}>
                                Round {round.sequenceNo}: {round.name}
                              </option>
                            ))}
                          </select>
                          {canReview && selectedRoundId && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={handleRecheck}
                              title="Check every deck link in this round is still public"
                              className="border border-[#17201d]/20 px-3 py-2 text-sm disabled:opacity-50"
                            >
                              Recheck links
                            </button>
                          )}
                        </div>
                      </div>
                      {selectedSubmission ? (
                        <div className="mt-5">
                          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#55705c]">
                            <span>
                              {selectedSubmission.status.replaceAll("_", " ")}
                            </span>
                            {selectedSubmission.submittedAt && (
                              <span>
                                · {formatDate(selectedSubmission.submittedAt)}
                              </span>
                            )}
                          </div>
                          <h4 className="mt-2 text-2xl font-semibold">
                            {selectedSubmission.title || "Untitled submission"}
                          </h4>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#17201d]/75">
                            {selectedSubmission.description ||
                              "No description provided."}
                          </p>
                          {selectedSubmission.driveLink && (
                            <div className="mt-4">
                              <a
                                href={selectedSubmission.driveLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-sm font-medium text-[#55705c] underline"
                              >
                                Open submission link
                              </a>
                              <DriveLinkStatus
                                status={selectedSubmission.driveLinkStatus}
                                name={selectedSubmission.driveLinkName}
                                modifiedAt={
                                  selectedSubmission.driveLinkModifiedAt
                                }
                                checkedAt={
                                  selectedSubmission.driveLinkCheckedAt
                                }
                                deadline={data.submissionDeadline}
                              />
                            </div>
                          )}
                          {canReview && (
                            <div className="mt-5 border-t border-[#17201d]/10 pt-4">
                              <textarea
                                value={remarks}
                                onChange={(event) =>
                                  setRemarks(event.target.value)
                                }
                                placeholder="Review remarks"
                                rows={3}
                                className="w-full border border-[#17201d]/20 px-3 py-2 text-sm"
                              />
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => handleReview("accepted")}
                                  className="bg-[#315c38] px-4 py-2 text-sm text-white disabled:opacity-50"
                                >
                                  Accept submission
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => handleReview("rejected")}
                                  className="border border-[#a24b3d] px-4 py-2 text-sm text-[#8a352a] disabled:opacity-50"
                                >
                                  Reject submission
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-5 border border-dashed border-[#17201d]/20 p-5 text-sm text-[#17201d]/55">
                          No submission for this round.
                        </p>
                      )}
                    </section>

                    <section className="border border-[#17201d]/15 bg-white p-5">
                      <h3 className="text-lg font-semibold">Team members</h3>
                      <div className="mt-4 divide-y divide-[#17201d]/10">
                        {selectedMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex justify-between gap-4 py-3 text-sm"
                          >
                            <span>
                              {member.name}
                              {member.isLeader && (
                                <span className="ml-2 text-xs text-[#55705c]">
                                  leader
                                </span>
                              )}
                            </span>
                            <span className="text-right text-[#17201d]/55">
                              {member.raNumber} · {member.netId}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    {canScan && (
                      <section className="border border-[#17201d]/15 bg-white p-5">
                        <h3 className="text-lg font-semibold">Attendance</h3>
                        <p className="mt-1 text-sm text-[#17201d]/55">
                          Scan a team pass at the event desk.
                        </p>
                        <Link
                          href="/admin/attendance"
                          className="mt-5 block w-full border border-[#17201d] px-4 py-3 text-center text-sm"
                        >
                          Open scanner
                        </Link>
                      </section>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
