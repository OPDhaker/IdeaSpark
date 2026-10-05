"use client";

import { Download, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { exportPanelAssignmentsCsv } from "@/actions/export";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { downloadFile } from "@/lib/download";
import { formatDate } from "../_lib/format";

type Round = {
  id: string;
  name: string;
  eventDate: string;
  isActive: boolean;
};

/** Defaults to the active round, the one panels are being set up for. */
export function PanelExportDialog({
  rounds,
  assignedByRound,
}: {
  rounds: Round[];
  /** `team_panel_assignments` rows, keyed by round id. */
  assignedByRound: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [roundId, setRoundId] = useState(
    (rounds.find((round) => round.isActive) ?? rounds[0])?.id ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setPending(true);
    setError("");
    try {
      const { filename, csv, rowCount, unassignedCount } =
        await exportPanelAssignmentsCsv(roundId);
      downloadFile(filename, csv);
      toast.success(
        `Exported ${rowCount} ${rowCount === 1 ? "assignment" : "assignments"}${
          unassignedCount ? ` | ${unassignedCount} unassigned` : ""
        }`,
      );
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users aria-hidden className="size-4" />
          Export panel list
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export panel list</DialogTitle>
          <DialogDescription>
            Every team mapped to its panels for the chosen round, with the
            tracks each panel covers.
          </DialogDescription>
        </DialogHeader>

        <NativeSelect
          aria-label="Evaluation round"
          value={roundId}
          onChange={(event) => setRoundId(event.target.value)}
        >
          {rounds.map((round) => (
            <NativeSelectOption key={round.id} value={round.id}>
              {round.name} | {formatDate(round.eventDate)} |{" "}
              {assignedByRound[round.id] ?? 0} assigned
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <p className="text-muted-foreground text-xs">
          Columns: Panel, Panel type, Panel tracks, Team, Team track, Judges.
          Accepted, paid teams without a panel are listed last as Unassigned.
        </p>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={download} disabled={pending || !roundId}>
            {pending ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden className="size-4" />
            )}
            Download CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
