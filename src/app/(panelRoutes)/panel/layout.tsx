import { redirect } from "next/navigation";
import { getPanelRounds } from "@/actions/panel";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { PanelSidebar } from "./_components/panel-sidebar";

export const dynamic = "force-dynamic";

/**
 * Wraps every judging route.
 *
 * It lives at `panel/layout.tsx` rather than at the `(panelRoutes)` root for
 * the same reason the dashboard's does: the group adds no path segment, so the
 * generated `LayoutProps<"/panel">` is only unambiguous here.
 *
 * This is also where `/panel` stops being open to anyone with a Google account.
 * `src/proxy.ts` has no concept of roles — it only proves you are signed in —
 * so the role check has to happen on the server, in the route itself.
 */
export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  let data: Awaited<ReturnType<typeof getPanelRounds>>;
  try {
    data = await getPanelRounds();
  } catch {
    // `requireAdminRole` throws for a signed-in non-evaluator. Send them to the
    // landing page rather than a 500 — there is nothing here for them.
    redirect("/");
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
    >
      <PanelSidebar
        userName={data.admin.name}
        userEmail={null}
        panelName={data.panel?.name ?? null}
        judges={data.judges}
        rounds={data.rounds.map((round) => ({
          slug: round.slug,
          name: round.name,
          eventDate: round.eventDate,
          isActive: round.isActive,
        }))}
      />
      <SidebarInset>
        <div className="flex items-center gap-2 px-4 pt-4 md:hidden">
          <SidebarTrigger />
          <span className="font-serif text-lg">Judging Panel</span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
