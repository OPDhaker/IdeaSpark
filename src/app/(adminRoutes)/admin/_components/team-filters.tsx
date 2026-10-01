"use client";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  DEFAULT_FILTERS,
  type TeamFilters as Filters,
  hasActiveFilters,
  SORT_OPTIONS,
  type TeamSort,
  type TrackOption,
} from "../_lib/team-filters";

export function TeamFilters({
  filters,
  sort,
  tracks,
  shown,
  total,
  onChange,
  onSort,
}: {
  filters: Filters;
  sort: TeamSort;
  tracks: TrackOption[];
  shown: number;
  total: number;
  onChange: (filters: Filters) => void;
  onSort: (sort: TeamSort) => void;
}) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="mt-3 grid gap-2">
      <NativeSelect
        size="sm"
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
          size="sm"
          aria-label="Submission"
          value={filters.submission}
          onChange={(event) =>
            set("submission", event.target.value as Filters["submission"])
          }
        >
          <NativeSelectOption value="all">Any submission</NativeSelectOption>
          <NativeSelectOption value="submitted">Submitted</NativeSelectOption>
          <NativeSelectOption value="not_submitted">
            Not submitted
          </NativeSelectOption>
        </NativeSelect>

        <NativeSelect
          size="sm"
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
          size="sm"
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
          <NativeSelectOption value="in_review">In review</NativeSelectOption>
          <NativeSelectOption value="accepted">Accepted</NativeSelectOption>
          <NativeSelectOption value="rejected">Rejected</NativeSelectOption>
        </NativeSelect>

        <NativeSelect
          size="sm"
          aria-label="Sort"
          value={sort}
          onChange={(event) => onSort(event.target.value as TeamSort)}
        >
          {SORT_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span>
          {shown} of {total} teams
        </span>
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
