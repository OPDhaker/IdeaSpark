"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  reviewSubmission,
  scanAttendance,
  setTeamStatus,
  upsertScore,
} from "@/app/actions";

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
    status: "pending" | "approved" | "rejected";
    paymentStatus: "unpaid" | "paid" | null;
  }>;
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
    score: string;
    remarks: string | null;
  }>;
};

export function AdminDashboard({ data }: { data: ReviewData }) {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState(data.teams[0]?.id ?? "");
  const [selectedRoundId, setSelectedRoundId] = useState(
    data.rounds.find((round) => round.isActive)?.id ?? data.rounds[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [score, setScore] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attendanceCode, setAttendanceCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId);
  const selectedRound = data.rounds.find(
    (round) => round.id === selectedRoundId,
  );
  const selectedSubmission = data.submissions.find(
    (submission) =>
      submission.teamId === selectedTeamId &&
      submission.roundId === selectedRoundId,
  );
  const existingScore = data.scores.find(
    (row) =>
      row.teamId === selectedTeamId &&
      row.roundId === selectedRoundId &&
      row.evaluatorId === data.admin.id,
  );
  const selectedMembers = data.members.filter(
    (member) => member.teamId === selectedTeamId,
  );
  const visibleTeams = useMemo(
    () =>
      data.teams.filter((team) =>
        `${team.teamName} ${team.trackName ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [data.teams, query],
  );

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
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
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

  function handleTeamStatus(status: "approved" | "rejected" | "pending") {
    if (!selectedTeam) return;
    return run(() => setTeamStatus(selectedTeam.id, status), `Team ${status}.`);
  }

  function handleScore() {
    if (!selectedTeam || !selectedRound) return;
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Enter a score from 0 to 100.");
      return;
    }
    return run(
      () => upsertScore(selectedRound.id, selectedTeam.id, value, remarks),
      "Score saved.",
    );
  }

  function handleAttendance() {
    if (!attendanceCode.trim()) {
      setError("Enter an attendance code.");
      return;
    }
    return run(
      () => scanAttendance(attendanceCode),
      "Attendance recorded or was already present.",
    ).then(() => setAttendanceCode(""));
  }

  const canReview = data.admin.role === "super_admin";
  const canScore =
    data.admin.role === "super_admin" || data.admin.role === "evaluator";
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="border border-[#17201d]/15 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Teams</h2>
              <span className="text-xs text-[#17201d]/50">
                {data.teams.length}
              </span>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams"
              className="mt-4 w-full border border-[#17201d]/20 px-3 py-2 text-sm outline-none focus:border-[#55705c]"
            />
            <div className="mt-4 space-y-1">
              {visibleTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full border-l-2 px-3 py-3 text-left ${selectedTeamId === team.id ? "border-[#55705c] bg-[#edf3ec]" : "border-transparent hover:bg-[#f5f4f0]"}`}
                >
                  <span className="block font-medium">{team.teamName}</span>
                  <span className="mt-1 block text-xs text-[#17201d]/55">
                    {team.trackName ?? "No track"} · {team.status}
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
                  </div>
                  {canReview && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleTeamStatus("approved")}
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
                      </div>
                      {selectedSubmission ? (
                        <div className="mt-5">
                          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#55705c]">
                            <span>
                              {selectedSubmission.status.replaceAll("_", " ")}
                            </span>
                            {selectedSubmission.submittedAt && (
                              <span>
                                ·{" "}
                                {new Date(
                                  selectedSubmission.submittedAt,
                                ).toLocaleDateString()}
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
                            <a
                              href={selectedSubmission.driveLink}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-4 inline-block text-sm font-medium text-[#55705c] underline"
                            >
                              Open submission link
                            </a>
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
                    {canScore && (
                      <section className="border border-[#17201d]/15 bg-[#e8f0e6] p-5">
                        <h3 className="text-lg font-semibold">
                          Score this team
                        </h3>
                        <p className="mt-1 text-sm text-[#17201d]/60">
                          {selectedRound?.name ?? "Select a round"}
                        </p>
                        <label className="mt-5 block text-sm font-medium">
                          Score / 100
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={score || existingScore?.score || ""}
                            onChange={(event) => setScore(event.target.value)}
                            className="mt-2 w-full border border-[#17201d]/20 bg-white px-3 py-2"
                          />
                        </label>
                        <textarea
                          value={remarks}
                          onChange={(event) => setRemarks(event.target.value)}
                          placeholder="Scoring remarks"
                          rows={4}
                          className="mt-4 w-full border border-[#17201d]/20 bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={pending || !selectedRound}
                          onClick={handleScore}
                          className="mt-4 w-full bg-[#17201d] px-4 py-3 text-sm text-white disabled:opacity-50"
                        >
                          Save score
                        </button>
                      </section>
                    )}
                    {canScan && (
                      <section className="border border-[#17201d]/15 bg-white p-5">
                        <h3 className="text-lg font-semibold">Attendance</h3>
                        <p className="mt-1 text-sm text-[#17201d]/55">
                          Scan a member code at the event desk.
                        </p>
                        <input
                          value={attendanceCode}
                          onChange={(event) =>
                            setAttendanceCode(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void handleAttendance();
                          }}
                          placeholder="Attendance code"
                          className="mt-5 w-full border border-[#17201d]/20 px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void handleAttendance()}
                          className="mt-3 w-full border border-[#17201d] px-4 py-3 text-sm disabled:opacity-50"
                        >
                          Mark attendance
                        </button>
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
