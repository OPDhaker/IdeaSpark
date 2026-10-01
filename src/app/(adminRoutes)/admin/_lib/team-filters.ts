/**
 * Filtering, sorting and counting for the `/admin` team list.
 *
 * Pure functions over the rows `getAdminReviewData` already returns, so the
 * overview counts and the filtered list can never disagree: a card's number is
 * exactly how many rows its filter leaves.
 */

export type ReviewStatus =
  | "pending_submission"
  | "in_review"
  | "rejected"
  | "accepted";

export type FilterableTeam = {
  id: string;
  teamName: string;
  trackId: string | null;
  trackName: string | null;
  status: ReviewStatus;
  paymentStatus: "unpaid" | "paid";
  createdAt: Date;
};

export type TrackOption = { id: string; name: string; isActive: boolean };

/** `"none"` matches teams that have not picked a track. */
export type TrackFilter = "all" | "none" | (string & {});

export type TeamFilters = {
  query: string;
  trackId: TrackFilter;
  submission: "all" | "submitted" | "not_submitted";
  payment: "all" | "paid" | "unpaid";
  decision: "all" | ReviewStatus;
};

export const DEFAULT_FILTERS: TeamFilters = {
  query: "",
  trackId: "all",
  submission: "all",
  payment: "all",
  decision: "all",
};

export type TeamSort = "newest" | "oldest" | "name_asc" | "name_desc" | "track";

export const SORT_OPTIONS: Array<{ value: TeamSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A to Z" },
  { value: "name_desc", label: "Name Z to A" },
  { value: "track", label: "Track" },
];

/**
 * A team has submitted once it leaves `pending_submission`:
 * `submitIdeaAtomically` moves it to `in_review`, and review moves it on from
 * there. A manual override back to `pending_submission` reopens it.
 */
export function isSubmitted(status: ReviewStatus) {
  return status !== "pending_submission";
}

export function hasActiveFilters(filters: TeamFilters) {
  return (Object.keys(DEFAULT_FILTERS) as Array<keyof TeamFilters>).some(
    (key) => filters[key] !== DEFAULT_FILTERS[key],
  );
}

export function filterTeams<T extends FilterableTeam>(
  teams: T[],
  filters: TeamFilters,
) {
  const query = filters.query.trim().toLowerCase();

  return teams.filter((team) => {
    if (
      query &&
      !`${team.teamName} ${team.trackName ?? ""}`.toLowerCase().includes(query)
    ) {
      return false;
    }
    if (filters.trackId === "none" && team.trackId) return false;
    if (
      filters.trackId !== "all" &&
      filters.trackId !== "none" &&
      team.trackId !== filters.trackId
    ) {
      return false;
    }
    if (filters.submission !== "all") {
      if (isSubmitted(team.status) !== (filters.submission === "submitted")) {
        return false;
      }
    }
    if (filters.payment !== "all" && team.paymentStatus !== filters.payment) {
      return false;
    }
    if (filters.decision !== "all" && team.status !== filters.decision) {
      return false;
    }
    return true;
  });
}

const byName = (a: FilterableTeam, b: FilterableTeam) =>
  a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" });

const byCreated = (a: FilterableTeam, b: FilterableTeam) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

export function sortTeams<T extends FilterableTeam>(
  teams: T[],
  sort: TeamSort,
) {
  const sorted = [...teams];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => byCreated(b, a));
    case "oldest":
      return sorted.sort(byCreated);
    case "name_asc":
      return sorted.sort(byName);
    case "name_desc":
      return sorted.sort((a, b) => byName(b, a));
    case "track":
      // Teams without a track sink to the bottom.
      return sorted.sort(
        (a, b) =>
          (a.trackName ?? "￿").localeCompare(b.trackName ?? "￿") ||
          byName(a, b),
      );
  }
}

export type TeamCounts = {
  total: number;
  submitted: number;
  notSubmitted: number;
  inReview: number;
  accepted: number;
  rejected: number;
  paid: number;
  unpaid: number;
  acceptedUnpaid: number;
};

export type TrackRow = {
  trackId: TrackFilter;
  name: string;
  isActive: boolean;
  teams: number;
  submitted: number;
  accepted: number;
  paid: number;
};

export function summarize(teams: FilterableTeam[], tracks: TrackOption[]) {
  const counts: TeamCounts = {
    total: teams.length,
    submitted: 0,
    notSubmitted: 0,
    inReview: 0,
    accepted: 0,
    rejected: 0,
    paid: 0,
    unpaid: 0,
    acceptedUnpaid: 0,
  };

  const rows = new Map<string, TrackRow>(
    tracks.map((track) => [
      track.id,
      {
        trackId: track.id,
        name: track.name,
        isActive: track.isActive,
        teams: 0,
        submitted: 0,
        accepted: 0,
        paid: 0,
      },
    ]),
  );
  const noTrack: TrackRow = {
    trackId: "none",
    name: "No track",
    isActive: true,
    teams: 0,
    submitted: 0,
    accepted: 0,
    paid: 0,
  };

  for (const team of teams) {
    const submitted = isSubmitted(team.status);
    const paid = team.paymentStatus === "paid";

    if (submitted) counts.submitted++;
    else counts.notSubmitted++;
    if (team.status === "in_review") counts.inReview++;
    if (team.status === "accepted") counts.accepted++;
    if (team.status === "rejected") counts.rejected++;
    if (paid) counts.paid++;
    else counts.unpaid++;
    if (team.status === "accepted" && !paid) counts.acceptedUnpaid++;

    const row = (team.trackId && rows.get(team.trackId)) || noTrack;
    row.teams++;
    if (submitted) row.submitted++;
    if (team.status === "accepted") row.accepted++;
    if (paid) row.paid++;
  }

  const trackRows = [...rows.values()].filter(
    // A retired track only earns a row if someone is still on it.
    (row) => row.isActive || row.teams > 0,
  );
  if (noTrack.teams > 0) trackRows.push(noTrack);

  return { counts, trackRows };
}
