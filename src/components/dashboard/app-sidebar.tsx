"use client";

import { LayoutDashboard, LogOut, Trophy, Users } from "lucide-react";
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

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const BASE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/team-details", label: "Team Details", icon: Users },
];

const LEADERBOARD: NavItem = {
  href: "/dashboard/leaderboard",
  label: "Leaderboard",
  icon: Trophy,
};

export function AppSidebar({
  userName,
  userEmail,
  leaderboardVisible,
}: {
  userName: string | null;
  userEmail: string | null;
  /**
   * Hiding the item is decoration only — the route itself re-checks the date,
   * so guessing the URL hits the same refusal.
   */
  leaderboardVisible: boolean;
}) {
  const pathname = usePathname();
  const { signOut, pending } = useSignOut();

  const items = leaderboardVisible ? [...BASE_NAV, LEADERBOARD] : BASE_NAV;

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 pt-4 pb-2">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/fc-icons/logo.svg"
            alt=""
            width={24}
            height={36}
            className="h-9 w-6 object-contain"
          />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-xl">IdeaSpark 3.0</span>
            <span className="text-muted-foreground text-xs">
              Founders Club SRM
            </span>
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
                    // `/dashboard` is a prefix of every other item, so only it
                    // gets an exact match.
                    isActive={
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-2">
          <p className="truncate font-medium text-sm">
            {userName ?? "Team lead"}
          </p>
          {userEmail ? (
            <p className="truncate text-muted-foreground text-xs">
              {userEmail}
            </p>
          ) : null}
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
