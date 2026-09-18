"use client";

import { useEffect, useState } from "react";

function remaining(target: number) {
  const ms = target - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

/**
 * Live countdown to the submission deadline.
 *
 * The server renders the absolute date only; the relative part appears after
 * mount. Rendering "3 days left" on the server would hydrate against a
 * different clock and mismatch.
 */
export function DeadlineCountdown({ deadline }: { deadline: string }) {
  const target = new Date(deadline).getTime();
  const [left, setLeft] = useState<ReturnType<typeof remaining> | undefined>();

  useEffect(() => {
    setLeft(remaining(target));
    const timer = setInterval(() => setLeft(remaining(target)), 30_000);
    return () => clearInterval(timer);
  }, [target]);

  const absolute = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(deadline));

  return (
    <span>
      {absolute}
      {left === undefined ? null : left === null ? (
        <span className="text-muted-foreground"> · closed</span>
      ) : (
        <span className="text-muted-foreground">
          {" · "}
          {left.days > 0
            ? `${left.days}d ${left.hours}h left`
            : `${left.hours}h ${left.minutes}m left`}
        </span>
      )}
    </span>
  );
}
