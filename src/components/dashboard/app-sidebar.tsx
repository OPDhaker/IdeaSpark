"use client";

import {
  ExternalLink,
  LayoutDashboard,
  Lock,
  LogOut,
  Trophy,
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
import { WHATSAPP_INVITE_URL } from "@/lib/event";

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
   * `event_config.leaderboard_published`. Only controls whether the item is
   * reachable — the route re-checks it, so guessing the URL hits the same
   * refusal.
   */
  leaderboardVisible: boolean;
}) {
  const pathname = usePathname();
  const { signOut, pending } = useSignOut();

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
              {BASE_NAV.map((item) => (
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

              {/*
                The item is always in the nav — teams should know the board
                exists — but it stays a dead, locked row until a super admin
                publishes it, rather than linking to a page that can only
                refuse them. No date is shown because there is no date to
                promise: publishing happens when judging is done.
              */}
              <SidebarMenuItem>
                {leaderboardVisible ? (
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(LEADERBOARD.href)}
                  >
                    <Link href={LEADERBOARD.href}>
                      <LEADERBOARD.icon aria-hidden />
                      <span>{LEADERBOARD.label}</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton disabled>
                    <LEADERBOARD.icon aria-hidden />
                    <span>{LEADERBOARD.label}</span>
                    <Lock aria-hidden className="ml-auto size-3.5" />
                    {/* A bare icon is not a reason; name the state. */}
                    <span className="sr-only">Locked</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>

              {/*
                Not in `BASE_NAV`: that array is mapped through `next/link`
                with pathname matching, and an off-site URL has neither a
                route to match nor an active state.
              */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a
                    href={WHATSAPP_INVITE_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <ExternalLink aria-hidden />
                    <span>WhatsApp</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
