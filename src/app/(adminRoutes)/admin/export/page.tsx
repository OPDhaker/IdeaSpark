import { asc, count } from "drizzle-orm";
import { db } from "@/db";
import { getEventConfig, listEvaluationRounds } from "@/db/queries";
import { attendance, teamPanelAssignments, teams, tracks } from "@/db/schema";
import { requireAdminRole } from "@/lib/roles";
import { ExportDialog } from "./export-dialog";
import { OdListDialog } from "./od-list-dialog";
import { PanelExportDialog } from "./panel-export-dialog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Export | IdeaSpark 3.0",
};

export default async function AdminExportPage() {
  // The hidden nav row is presentation only; this throws for anyone else.
  await requireAdminRole(["super_admin"]);

  const [trackRows, teamRows, config, presentRows, rounds, assignedRows] =
    await Promise.all([
      db
        .select({ id: tracks.id, name: tracks.name, isActive: tracks.isActive })
        .from(tracks)
        .orderBy(asc(tracks.name)),
      db.select({ paymentStatus: teams.paymentStatus }).from(teams),
      getEventConfig(),
      db
        .select({ date: attendance.eventDate, present: count() })
        .from(attendance)
        .groupBy(attendance.eventDate),
      listEvaluationRounds(),
      db
        .select({ roundId: teamPanelAssignments.roundId, assigned: count() })
        .from(teamPanelAssignments)
        .groupBy(teamPanelAssignments.roundId),
    ]);
  const paid = teamRows.filter((t) => t.paymentStatus === "paid").length;
  const presentByDate = Object.fromEntries(
    presentRows.map((row) => [row.date, row.present]),
  );
  const assignedByRound = Object.fromEntries(
    assignedRows.map((row) => [row.roundId, row.assigned]),
  );

  return (
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full max-w-[820px] gap-8">
        <header>
          <h1 className="font-serif text-5xl leading-none tracking-[-0.03em]">
            Export
          </h1>
          <p className="mt-3 text-muted-foreground text-sm">
            Teams, attendance and panels as spreadsheets. These files hold
            student details, so keep them out of shared drives.
          </p>
        </header>

        <div className="rounded-md border border-foreground/15 p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-prose">
              <h2 className="font-medium">Teams CSV</h2>
              <p className="mt-2 text-muted-foreground text-sm">
                {teamRows.length} teams | {paid} paid | {teamRows.length - paid}{" "}
                unpaid
              </p>
              <p className="mt-3 text-muted-foreground text-xs">
                One row per team. Leader contact, payment and submission state
                by default. Pick filters and extra columns before downloading.
              </p>
            </div>

            <ExportDialog tracks={trackRows} />
          </div>
        </div>

        <div className="rounded-md border border-foreground/15 p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-prose">
              <h2 className="font-medium">OD list</h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Every member scanned in on the chosen day, for department OD
                letters.
              </p>
              <p className="mt-3 text-muted-foreground text-xs">
                One row per student, grouped by department and faculty advisor.
              </p>
            </div>

            {config ? (
              <OdListDialog
                dayOne={config.dayOne}
                dayTwo={config.dayTwo}
                attendanceDay={config.attendanceDay}
                presentByDate={presentByDate}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Event configuration is not initialized. Run <code>db:seed</code>{" "}
                first.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-foreground/15 p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-prose">
              <h2 className="font-medium">Panel list</h2>
              <p className="mt-2 text-muted-foreground text-sm">
                Every team mapped to its panels, with the tracks each panel
                covers.
              </p>
              <p className="mt-3 text-muted-foreground text-xs">
                One row per team per panel, grouped by panel, with its judges.
              </p>
            </div>

            {rounds.length > 0 ? (
              <PanelExportDialog
                rounds={rounds}
                assignedByRound={assignedByRound}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                No evaluation rounds yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
