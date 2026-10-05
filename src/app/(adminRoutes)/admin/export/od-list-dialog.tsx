"use client";

import { ClipboardCheck, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { exportOdListCsv } from "@/actions/export";
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

type EventDay = "day_one" | "day_two";

/**
 * Defaults to the day the door is open for, since that is the list someone is
 * most likely to want while the event runs.
 */
export function OdListDialog({
  dayOne,
  dayTwo,
  attendanceDay,
  presentByDate,
}: {
  dayOne: string;
  dayTwo: string;
  attendanceDay: string | null;
  /** Members scanned in, keyed by `attendance.event_date`. */
  presentByDate: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<EventDay>(
    attendanceDay === dayTwo ? "day_two" : "day_one",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const days: Array<{ value: EventDay; label: string; date: string }> = [
    { value: "day_one", label: "Day 1", date: dayOne },
    { value: "day_two", label: "Day 2", date: dayTwo },
  ];
  const present = presentByDate[day === "day_one" ? dayOne : dayTwo] ?? 0;

  async function download() {
    setPending(true);
    setError("");
    try {
      const { filename, csv, rowCount } = await exportOdListCsv(day);
      downloadFile(filename, csv);
      toast.success(
        `Exported ${rowCount} ${rowCount === 1 ? "student" : "students"}`,
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
          <ClipboardCheck aria-hidden className="size-4" />
          Export OD list
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export OD list</DialogTitle>
          <DialogDescription>
            Every member scanned in on the chosen day, grouped by department.
          </DialogDescription>
        </DialogHeader>

        <NativeSelect
          aria-label="Event day"
          value={day}
          onChange={(event) => setDay(event.target.value as EventDay)}
        >
          {days.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label} | {formatDate(option.date)} |{" "}
              {presentByDate[option.date] ?? 0} present
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <p className="text-muted-foreground text-xs">
          Columns: S.No., Name, RA Number, Net ID, Department, FA Name, FA
          Email.
        </p>

        {present === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nobody has been scanned in on this day yet.
          </p>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={download} disabled={pending || present === 0}>
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
