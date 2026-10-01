import { Badge } from "@/components/ui/badge";
import { formatMoment } from "../_lib/format";

type Status = "public" | "restricted" | "unverified" | null;

const LABEL = {
  public: "Public",
  restricted: "Private link",
  unverified: "Unverified",
} as const;

const VARIANT = {
  public: "default",
  restricted: "destructive",
  unverified: "outline",
} as const;

export function DriveLinkBadge({ status }: { status: Status }) {
  if (!status) return <Badge variant="outline">Not checked</Badge>;
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}

/**
 * What the last Drive check said about a submission's link: whether judges can
 * open it, which file it is, and whether it changed after the deadline.
 */
export function DriveLinkStatus({
  status,
  name,
  modifiedAt,
  checkedAt,
  deadline,
}: {
  status: Status;
  name: string | null;
  modifiedAt: Date | null;
  checkedAt: Date | null;
  deadline: Date | null;
}) {
  const editedLate =
    modifiedAt && deadline && new Date(modifiedAt) > new Date(deadline);

  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <DriveLinkBadge status={status} />
        {editedLate ? (
          <Badge variant="destructive">Edited after deadline</Badge>
        ) : null}
        {name ? <span className="text-[#17201d]/75">{name}</span> : null}
      </div>
      {status === "restricted" ? (
        <p className="text-[#8a352a]">
          Drive refused an anonymous viewer. The team has to set it to Anyone
          with the link | Viewer.
        </p>
      ) : null}
      {status === "unverified" ? (
        <p className="text-[#17201d]/55">
          The check couldn&apos;t reach Drive. Recheck links to confirm.
        </p>
      ) : null}
      {checkedAt ? (
        <p className="text-xs text-[#17201d]/50">
          Checked {formatMoment(checkedAt)}
          {modifiedAt ? ` | last edited ${formatMoment(modifiedAt)}` : null}
        </p>
      ) : null}
    </div>
  );
}
