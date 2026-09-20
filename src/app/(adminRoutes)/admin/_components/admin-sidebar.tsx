"use client";

import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSignOut } from "@/lib/auth/use-sign-out";

type AdminRole = "super_admin" | "evaluator" | "volunteer";

const NAV = [
  {
    href: "/admin",
    label: "Control room",
    icon: LayoutDashboard,
    roles: ["super_admin", "evaluator", "volunteer"],
  },
  {
    href: "/admin/panels",
    label: "Judging panels",
    icon: Users,
    roles: ["super_admin"],
  },
  {
    href: "/admin/event",
    label: "Event controls",
    icon: Settings2,
    roles: ["super_admin"],
  },
] satisfies Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AdminRole[];
}>;

export function AdminSidebar({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: AdminRole;
}) {
  const pathname = usePathname();
  const { signOut, pending } = useSignOut();

  // Hiding a row is presentation only — each route runs its own
  // `requireAdminRole`, so typing the URL hits the same refusal.
  const items = NAV.filter((item) => item.roles.includes(role));
  const canJudge = role === "super_admin" || role === "evaluator";

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 pt-4 pb-2">
        <Link href="/admin" className="flex items-center gap-3">
          <Image
            src="/fc-icons/logo.svg"
            alt=""
            width={24}
            height={36}
            className="h-9 w-6 object-contain"
          />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-xl">Control room</span>
            <span className="text-muted-foreground text-xs">IdeaSpark 3.0</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    // `/admin` is a prefix of every other item, so only it
                    // gets an exact match.
                    isActive={
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(item.href)
                    }
                  >
                    <Link href={item.href}>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {canJudge ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/panel">
                      <ClipboardList aria-hidden />
                      <span>Judging panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-2">
          <p className="truncate font-medium text-sm">{name}</p>
          <p className="truncate text-muted-foreground text-xs">{email}</p>
          <p className="mt-1 truncate text-muted-foreground text-xs">
            {role.replace("_", " ")}
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} disabled={pending}>
              <LogOut aria-hidden />
              <span>{pending ? "Signing out…" : "Sign Out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
