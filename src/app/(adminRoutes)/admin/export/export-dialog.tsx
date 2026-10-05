"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { exportTeamsCsv } from "@/actions/export";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { downloadFile } from "@/lib/download";
import {
  DEFAULT_FILTERS,
  type TeamFilters as Filters,
  SORT_OPTIONS,
  type TeamSort,
  type TrackOption,
} from "../_lib/team-filters";
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMN_KEYS,
  EXPORT_COLUMNS,
  type ExportColumn,
} from "./_lib/columns";

/**
 * The filters mirror the `/admin` team list (same values, same
 * `filterTeams` on the server), so "Unpaid" here is the same set of teams as
 * "Unpaid" there.
 */
export function ExportDialog({ tracks }: { tracks: TrackOption[] }) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<TeamSort>("name_asc");
  const [columns, setColumns] = useState<ExportColumn[]>(
    DEFAULT_EXPORT_COLUMNS,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: ExportColumn, on: boolean) {
    setColumns((current) =>
      on ? [...current, key] : current.filter((c) => c !== key),
    );
  }

  async function download() {
    setPending(true);
    setError("");
    try {
      const { filename, csv, rowCount } = await exportTeamsCsv({
        filters,
        sort,
        columns,
      });
      downloadFile(filename, csv);
      toast.success(
        `Exported ${rowCount} ${rowCount === 1 ? "team" : "teams"}`,
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
        <Button>
          <Download aria-hidden className="size-4" />
          Export teams
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export teams</DialogTitle>
          <DialogDescription>
            One row per team, downloaded as CSV.
          </DialogDescription>
        </DialogHeader>

        <section className="grid gap-2">
          <h3 className="font-medium text-sm">Teams</h3>
          <NativeSelect
            aria-label="Track"
            value={filters.trackId}
            onChange={(event) => set("trackId", event.target.value)}
          >
            <NativeSelectOption value="all">All tracks</NativeSelectOption>
            {tracks.map((track) => (
              <NativeSelectOption key={track.id} value={track.id}>
                {track.name}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="none">No track</NativeSelectOption>
          </NativeSelect>

          <div className="grid grid-cols-2 gap-2">
            <NativeSelect
              aria-label="Submission"
              value={filters.submission}
              onChange={(event) =>
                set("submission", event.target.value as Filters["submission"])
              }
            >
              <NativeSelectOption value="all">
                Any submission
              </NativeSelectOption>
              <NativeSelectOption value="submitted">
                Submitted
              </NativeSelectOption>
              <NativeSelectOption value="not_submitted">
                Not submitted
              </NativeSelectOption>
            </NativeSelect>

            <NativeSelect
              aria-label="Payment"
              value={filters.payment}
              onChange={(event) =>
                set("payment", event.target.value as Filters["payment"])
              }
            >
              <NativeSelectOption value="all">Any payment</NativeSelectOption>
              <NativeSelectOption value="paid">Paid</NativeSelectOption>
              <NativeSelectOption value="unpaid">Unpaid</NativeSelectOption>
            </NativeSelect>

            <NativeSelect
              aria-label="Decision"
              value={filters.decision}
              onChange={(event) =>
                set("decision", event.target.value as Filters["decision"])
              }
            >
              <NativeSelectOption value="all">Any status</NativeSelectOption>
              <NativeSelectOption value="pending_submission">
                Pending submission
              </NativeSelectOption>
              <NativeSelectOption value="in_review">
                In review
              </NativeSelectOption>
              <NativeSelectOption value="accepted">Accepted</NativeSelectOption>
              <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
            </NativeSelect>

            <NativeSelect
              aria-label="Sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as TeamSort)}
            >
              {SORT_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Columns</h3>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setColumns([...EXPORT_COLUMN_KEYS])}
                className="font-medium text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setColumns(DEFAULT_EXPORT_COLUMNS)}
                className="font-medium text-primary hover:underline"
              >
                Defaults
              </button>
            </div>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((column) => {
              const id = `export-column-${column.key}`;
              return (
                <div key={column.key} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={columns.includes(column.key)}
                    onCheckedChange={(checked) =>
                      toggle(column.key, checked === true)
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {column.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </section>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={download} disabled={pending || columns.length === 0}>
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
