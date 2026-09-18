import { redirect } from "next/navigation";
import { getDashboardShell } from "@/app/actions";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

/**
 * Wraps all three team routes. It lives at `dashboard/layout.tsx` rather than
 * the `(teamRoutes)` root because the group adds no path segment, so the
 * generated `LayoutProps<"/dashboard">` is only unambiguous here.
 *
 * The one session read for the shell happens here, so the pages underneath
 * don't each repeat it.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  let shell: Awaited<ReturnType<typeof getDashboardShell>>;
  try {
    shell = await getDashboardShell();
  } catch {
    // proxy.ts already guards this route; if the matcher ever misses, degrade
    // into a redirect rather than a 500 out of `requireLead`.
    redirect("/login");
  }

  return (
    <SidebarProvider
      // 19rem, with the inset gutter and the panel's own padding, puts the
      // content column near the wireframe's 392px start and still fits a 1366
      // laptop.
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
    >
      <AppSidebar
        userName={shell.userName}
        userEmail={shell.userEmail}
        leaderboardVisible={shell.leaderboardVisible}
      />
      <SidebarInset>
        <div className="flex items-center gap-2 px-4 pt-4 md:hidden">
          <SidebarTrigger />
          <span className="font-serif text-lg">IdeaSpark 3.0</span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
