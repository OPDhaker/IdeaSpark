import { DoorClosed } from "lucide-react";
import Link from "next/link";
import { getScanContext } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import { AttendanceScanner } from "./_components/attendance-scanner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Attendance | IdeaSpark 3.0",
};

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

export default async function AttendancePage() {
  // `requireAdminRole(["volunteer", "super_admin"])` lives in the action, so
  // this throws for anyone else | the nav row is presentation only.
  const ctx = await getScanContext();

  return (
    <div className="px-4 py-6 md:p-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header>
          <h1 className="font-serif text-4xl leading-none tracking-[-0.03em] md:text-5xl">
            Mark attendance
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {ctx.eventDate
              ? `Scanning for ${ctx.dayLabel} | ${day(ctx.eventDate)}`
              : "Attendance is closed"}
          </p>
        </header>

        {ctx.eventDate ? (
          <AttendanceScanner />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
            <DoorClosed aria-hidden className="size-8 text-muted-foreground" />
            <p className="font-medium">Attendance is closed</p>
            <p className="text-muted-foreground text-sm">
              {ctx.canToggle
                ? "Open it for Day 1 or Day 2 from Event controls."
                : "A super admin opens it when the doors open. Reload once they do."}
            </p>
            {ctx.canToggle ? (
              <Button asChild size="lg" className="mt-2">
                <Link href="/admin/event">Open Event controls</Link>
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
