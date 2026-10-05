/**
 * The columns a team export can carry, in the order they appear in the file.
 *
 * Shared by the modal (which offers them) and `exportTeamsCsv` (which fills
 * them), so a checkbox can never name a column the server does not know.
 * `defaultOn` is the set a fresh modal starts with: who to call, and where
 * the team stands.
 */
export const EXPORT_COLUMNS = [
  { key: "teamName", label: "Team name", defaultOn: true },
  { key: "track", label: "Track", defaultOn: true },
  { key: "leaderName", label: "Leader name", defaultOn: true },
  { key: "leaderPhone", label: "Leader phone", defaultOn: true },
  { key: "paymentStatus", label: "Payment", defaultOn: true },
  { key: "submissionState", label: "Submission state", defaultOn: true },
  { key: "leaderEmail", label: "Leader email", defaultOn: false },
  { key: "leaderRaNumber", label: "Leader RA number", defaultOn: false },
  { key: "leaderNetId", label: "Leader Net ID", defaultOn: false },
  { key: "leaderDepartment", label: "Leader department", defaultOn: false },
  { key: "memberCount", label: "Team size", defaultOn: false },
  { key: "otherMembers", label: "Other members", defaultOn: false },
  { key: "paymentId", label: "Payment ID", defaultOn: false },
  { key: "deckLink", label: "Deck link (active round)", defaultOn: false },
  { key: "deckLinkStatus", label: "Deck link status", defaultOn: false },
  { key: "submittedAt", label: "Submitted at", defaultOn: false },
  { key: "registeredAt", label: "Registered at", defaultOn: false },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  defaultOn: boolean;
}>;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]["key"];

export const EXPORT_COLUMN_KEYS = EXPORT_COLUMNS.map((c) => c.key) as [
  ExportColumn,
  ...ExportColumn[],
];

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = EXPORT_COLUMNS.filter(
  (c) => c.defaultOn,
).map((c) => c.key);
