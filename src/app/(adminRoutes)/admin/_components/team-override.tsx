"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OverrideStatus = "accepted" | "rejected" | "pending_submission";

const ACTIONS: Array<{
  status: OverrideStatus;
  label: string;
  className: string;
}> = [
  {
    status: "accepted",
    label: "Force accept",
    className: "border-[#55705c] text-[#315c38]",
  },
  {
    status: "rejected",
    label: "Force reject",
    className: "border-[#a24b3d] text-[#8a352a]",
  },
  {
    status: "pending_submission",
    label: "Reopen for resubmission",
    className: "border-[#17201d]/30 text-[#17201d]",
  },
];

/**
 * The escape hatch, kept out of the way of the real review buttons: collapsed
 * by default, and every action goes through a dialog that spells out what it
 * does to this team and asks why. The server re-checks all of it
 * (`overrideTeamStatusAtomically`); this only makes a slip less likely.
 */
export function TeamOverride({
  team,
  roundName,
  hasSubmission,
  submissionDeadline,
  pending,
  onConfirm,
}: {
  team: { teamName: string; paymentStatus: "unpaid" | "paid" };
  /** The active round, which is the one an override touches. */
  roundName: string | null;
  /** Whether the team has a submitted deck in the active round. */
  hasSubmission: boolean;
  submissionDeadline: Date | null;
  pending: boolean;
  onConfirm: (status: OverrideStatus, reason: string) => Promise<boolean>;
}) {
  const [action, setAction] = useState<OverrideStatus | null>(null);
  const [reason, setReason] = useState("");
  const paid = team.paymentStatus === "paid";
  const round = roundName ?? "the active round";

  function open(status: OverrideStatus) {
    setReason("");
    setAction(status);
  }

  async function confirm() {
    if (!action) return;
    if (await onConfirm(action, reason)) setAction(null);
  }

  return (
    <details className="mt-5 border-t border-[#17201d]/10 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-[#17201d]/70">
        Override
      </summary>
      <p className="mt-2 text-sm text-[#17201d]/55">
        Bypasses review. Use it to fix a mistake.
        {paid ? " Paid teams can only be accepted." : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map(({ status, label, className }) => (
          <button
            key={status}
            type="button"
            disabled={pending || (paid && status !== "accepted")}
            onClick={() => open(status)}
            className={`border px-3 py-2 text-sm disabled:opacity-50 ${className}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Dialog
        open={action !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setAction(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {action ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {ACTIONS.find((a) => a.status === action)?.label}:{" "}
                  {team.teamName}?
                </DialogTitle>
                <DialogDescription>
                  {describe(action, team.teamName, round)}
                </DialogDescription>
              </DialogHeader>

              <Warnings
                action={action}
                round={round}
                hasSubmission={hasSubmission}
                submissionDeadline={submissionDeadline}
              />

              <label className="block text-sm">
                <span className="font-medium">Reason</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder={
                    action === "rejected"
                      ? "The team will see this."
                      : "Saved to the audit log."
                  }
                  className="mt-1 w-full border border-[#17201d]/20 px-3 py-2 text-sm"
                />
              </label>

              <DialogFooter>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setAction(null)}
                  className="border border-[#17201d]/20 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending || !reason.trim()}
                  onClick={confirm}
                  className="bg-[#17201d] px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Confirm override"}
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </details>
  );
}

function describe(action: OverrideStatus, team: string, round: string) {
  switch (action) {
    case "accepted":
      return `Sets ${team} and its ${round} submission to accepted. They can pay straight away.`;
    case "rejected":
      return `Sets ${team} and its ${round} submission to rejected. They'll see your reason on their dashboard.`;
    case "pending_submission":
      return `Clears ${team}'s ${round} submission, deck link included, so they can submit a new one. The old link is kept in the audit log.`;
  }
}

function Warnings({
  action,
  round,
  hasSubmission,
  submissionDeadline,
}: {
  action: OverrideStatus;
  round: string;
  hasSubmission: boolean;
  submissionDeadline: Date | null;
}) {
  const warnings: string[] = [];
  if (action !== "pending_submission" && !hasSubmission) {
    warnings.push(
      `This team has no submission in ${round}, so nothing was reviewed.`,
    );
  }
  if (
    action === "pending_submission" &&
    submissionDeadline &&
    new Date(submissionDeadline) < new Date()
  ) {
    warnings.push(
      "The submission deadline has passed, so they won't be able to submit again.",
    );
  }
  if (!warnings.length) return null;
  return (
    <ul className="space-y-1 border border-[#a24b3d]/40 bg-[#fff1ed] px-3 py-2 text-sm text-[#8a352a]">
      {warnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
    </ul>
  );
}
