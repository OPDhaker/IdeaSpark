import { redirect } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getAdminActor } from "@/lib/roles";
import { AdminSidebar } from "./_components/admin-sidebar";

export const dynamic = "force-dynamic";

/**
 * Wraps every admin route.
 *
 * `src/proxy.ts` only proves a visitor is signed in — it has no concept of
 * roles, so without this any Google account could load the control room. Each
 * page and action still checks its own role; this decides who sees the shell
 * at all, and which rows the nav offers.
 *
 * It sits at `admin/layout.tsx`, not at the `(adminRoutes)` root, because the
 * group adds no path segment and only this position yields an unambiguous
 * `LayoutProps<"/admin">`.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await getAdminActor();
  if (!admin) redirect("/");

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "19rem" } as React.CSSProperties}
    >
      <AdminSidebar name={admin.name} email={admin.email} role={admin.role} />
      <SidebarInset>
        <div className="flex items-center gap-2 px-4 pt-4 md:hidden">
          <SidebarTrigger />
          <span className="font-serif text-lg">Control room</span>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
