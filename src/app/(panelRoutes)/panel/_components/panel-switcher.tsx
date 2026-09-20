"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Super admin only: which panel's queue to look at.
 *
 * It changes the URL rather than local state, because the queue and its scores
 * are fetched per panel on the server. Picking a panel you are not on gives a
 * read-only sheet — writing still requires sitting on the team's panel.
 */
export function PanelSwitcher({
  slug,
  options,
  viewingPanelId,
  myPanelId,
}: {
  slug: string;
  options: Array<{ id: string; name: string; teamCount: number }>;
  viewingPanelId: string | null;
  myPanelId: string | null;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-muted-foreground text-xs">
      <Eye aria-hidden className="size-3.5" />
      <span>Viewing</span>
      <select
        value={viewingPanelId ?? "all"}
        onChange={(event) => {
          // Drop `?team=` too: the selected team rarely exists in the panel
          // being switched to, and the sheet would silently land elsewhere.
          router.push(`/panel/${slug}?panel=${event.target.value}`);
        }}
        className={cn(
          "rounded-md border border-foreground/20 bg-background px-2 py-1",
          "text-foreground text-xs",
        )}
      >
        <option value="all">All teams</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} ({option.teamCount})
            {option.id === myPanelId ? " · yours" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
