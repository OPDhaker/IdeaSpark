"use client";

import { DoorClosed, DoorOpen, Loader2 } from "lucide-react";
import { useState } from "react";
import { setAttendanceDay } from "@/actions/attendance";
import { Button } from "@/components/ui/button";

type Slot = "day_one" | "day_two" | null;

// `date` columns arrive as "YYYY-MM-DD", which `new Date()` reads as UTC
// midnight, so format in UTC too or the day can slip by one.
function day(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

/**
 * Opens the door scanner for one event day, or closes it. Like the leaderboard
 * switch, each button says what it will do rather than being a toggle whose
 * direction has to be inferred.
 */
export function AttendanceToggle({
  attendanceDay,
  dayOne,
  dayTwo,
}: {
  attendanceDay: string | null;
  dayOne: string;
  dayTwo: string;
}) {
  const [pending, setPending] = useState<Slot | "close" | undefined>();
  const [error, setError] = useState("");

  const open: Slot =
    attendanceDay === dayOne
      ? "day_one"
      : attendanceDay === dayTwo
        ? "day_two"
        : null;

  async function set(slot: Slot) {
    setPending(slot ?? "close");
    setError("");
    try {
      await setAttendanceDay(slot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setPending(undefined);
    }
  }

  const days = [
    { slot: "day_one" as const, label: "Day 1", date: dayOne },
    { slot: "day_two" as const, label: "Day 2", date: dayTwo },
  ];
  const openDay = days.find((d) => d.slot === open);

  return (
    <div className="rounded-md border border-foreground/15 p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-prose">
          <h2 className="flex items-center gap-2 font-medium">
            {openDay ? (
              <DoorOpen aria-hidden className="size-4" />
            ) : (
              <DoorClosed aria-hidden className="size-4" />
            )}
            Attendance
          </h2>
          <p className="mt-2 text-muted-foreground text-sm">
            {openDay
              ? `Open for ${openDay.label} (${day(openDay.date)}). Volunteers can scan team passes, and every scan counts for ${openDay.label}.`
              : "Closed. Volunteers see a closed screen at /admin/attendance and cannot mark anyone."}
          </p>
          <p className="mt-3 text-muted-foreground text-xs">
            Scans are filed under the day you open, not today&apos;s date.
            Judges can only score a team scanned on their round&apos;s day, so
            open the day that matches the round running in the room.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {days
            .filter((d) => d.slot !== open)
            .map((d) => (
              <Button
                key={d.slot}
                onClick={() => set(d.slot)}
                disabled={pending !== undefined}
                variant={openDay ? "outline" : "default"}
              >
                {pending === d.slot ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : null}
                {openDay ? `Switch to ${d.label}` : `Open for ${d.label}`}
              </Button>
            ))}
          {openDay ? (
            <Button
              onClick={() => set(null)}
              disabled={pending !== undefined}
              variant="destructive"
            >
              {pending === "close" ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              Close attendance
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
