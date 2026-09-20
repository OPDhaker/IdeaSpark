"use client";

import { ClipboardList, LogOut, Trophy, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSignOut } from "@/lib/auth/use-sign-out";

export type PanelRoundNav = {
  slug: string;
  name: string;
  eventDate: string;
  isActive: boolean;
};

/** `event_date` is a calendar day, so render it as one — no time, IST. */
function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${day}T00:00:00+05:30`));
}

export function PanelSidebar({
  userName,
  userEmail,
  panelName,
  judges,
  rounds,
}: {
  userName: string;
  userEmail: string | null;
  /** Null when nobody has put this evaluator on a panel yet. */
  panelName: string | null;
  judges: Array<{ id: string; name: string }>;
  rounds: PanelRoundNav[];
}) {
  const pathname = usePathname();
  const { signOut, pending } = useSignOut();

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="px-4 pt-4 pb-2">
        <Link href="/panel" className="flex items-center gap-3">
          <Image
            src="/fc-icons/logo.svg"
            alt=""
            width={24}
            height={36}
            className="h-9 w-6 object-contain"
          />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-xl">Judging Panel</span>
            <span className="text-muted-foreground text-xs">IdeaSpark 3.0</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/panel"}>
                  <Link href="/panel">
                    <Users aria-hidden />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {rounds.map((round) => (
          <SidebarGroup key={round.slug}>
            <SidebarGroupLabel>
              {round.name}
              <span className="ml-auto text-xs">
                {round.isActive ? "Live" : formatDay(round.eventDate)}
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/panel/${round.slug}`}
                  >
                    <Link href={`/panel/${round.slug}`}>
                      <ClipboardList aria-hidden />
                      <span>Score teams</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/panel/${round.slug}/leaderboard`}
                  >
                    <Link href={`/panel/${round.slug}/leaderboard`}>
                      <Trophy aria-hidden />
                      <span>Leaderboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-2">
          <p className="truncate font-medium text-sm">{userName}</p>
          {userEmail ? (
            <p className="truncate text-muted-foreground text-xs">
              {userEmail}
            </p>
          ) : null}
          <p className="mt-2 truncate text-muted-foreground text-xs">
            {panelName
              ? `${panelName} · ${judges.length} judge${judges.length === 1 ? "" : "s"}`
              : "Not on a panel"}
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
