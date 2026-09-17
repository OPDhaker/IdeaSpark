"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact progress header. Shows one marker per step the current team size
 * actually has, so it shrinks from 5 markers to 3 when the count drops to 2.
 */
export function StepIndicator({
  current,
  total,
  labels,
}: {
  current: number;
  total: number;
  labels: string[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-semibold text-foreground text-base">
          {labels[current - 1]}
        </p>
        {/*<p className="text-muted-foreground text-sm tabular-nums">
          Step {current} of {total}
        </p>*/}
      </div>

      <ol
        className="flex items-center gap-2"
        aria-label="Registration progress"
      >
        {Array.from({ length: total }, (_, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;

          return (
            <li
              key={labels[index] ?? step}
              className="flex flex-1 items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active &&
                    "border-primary border-2 font-extrabold text-primary",
                  !done &&
                    !active &&
                    "border-foreground/25 text-muted-foreground",
                )}
              >
                {done ? (
                  <Check aria-hidden strokeWidth={3.5} className="size-3.5" />
                ) : (
                  step
                )}
              </span>
              {step < total ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    done ? "bg-primary" : "bg-foreground/20",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
