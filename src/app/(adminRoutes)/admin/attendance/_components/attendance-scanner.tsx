"use client";

import { ArrowRight, Keyboard } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  lookupTeamAttendance,
  type TeamAttendance,
} from "@/actions/attendance";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { AttendanceSheet } from "./attendance-sheet";
import { QrViewfinder } from "./qr-viewfinder";

export function AttendanceScanner() {
  const [data, setData] = useState<TeamAttendance | null>(null);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [looking, startLookup] = useTransition();

  function lookup(code: string) {
    startLookup(async () => {
      try {
        setData(await lookupTeamAttendance(code));
        setOpen(true);
        setManual("");
      } catch (cause) {
        toast.error(
          cause instanceof Error ? cause.message : "Could not read that pass",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <QrViewfinder paused={open || looking} onScan={lookup} />
        {looking ? (
          <div className="absolute inset-x-0 bottom-4 flex justify-center">
            <span className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm shadow">
              <Spinner />
              Looking up team…
            </span>
          </div>
        ) : null}
      </div>

      <p className="text-center text-muted-foreground text-sm">
        Point the camera at the team pass on the receipt.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (manual.trim()) lookup(manual);
        }}
      >
        <InputGroup className="h-12">
          <InputGroupAddon>
            <Keyboard aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Or type the pass code"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Pass code"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              size="icon-sm"
              disabled={looking || !manual.trim()}
              aria-label="Look up"
            >
              <ArrowRight aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      <AttendanceSheet
        data={data}
        open={open}
        onOpenChange={setOpen}
        onSaved={(members) =>
          setData((prev) => (prev ? { ...prev, members } : prev))
        }
      />
    </div>
  );
}
