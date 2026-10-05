"use client";

import { BadgeCheck, Ban, CheckCheck, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setTeamAttendance, type TeamAttendance } from "@/actions/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";

type Member = TeamAttendance["members"][number];

const time = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Bottom sheet on phones, dialog on wider screens (shadcn's drawer-dialog
 * pattern). Both wrap the same body.
 */
export function AttendanceSheet({
  data,
  open,
  onOpenChange,
  onSaved,
}: {
  data: TeamAttendance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (members: Member[]) => void;
}) {
  const isMobile = useIsMobile();
  if (!data) return null;

  const title = data.team.teamName;
  const description = data.team.trackName ?? "No track";
  // Keyed on the roster so a fresh scan, or a save that brings back another
  // volunteer's marks, resets the ticks instead of keeping a stale draft.
  const bodyKey = `${data.team.id}:${data.members
    .map((m) => `${m.id}=${m.present}`)
    .join(",")}`;
  const body = (
    <SheetBody
      key={bodyKey}
      data={data}
      isMobile={isMobile}
      onDone={(members) => {
        onSaved(members);
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-serif text-2xl">{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function SheetBody({
  data,
  isMobile,
  onDone,
  onClose,
}: {
  data: TeamAttendance;
  isMobile: boolean;
  onDone: (members: Member[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(
    () => new Set(data.members.filter((m) => m.present).map((m) => m.id)),
  );
  const [pending, startTransition] = useTransition();

  // Only what this volunteer changed is sent, so a mark another volunteer made
  // after this sheet loaded is never undone by saving it.
  const changes = data.members
    .filter((m) => checked.has(m.id) !== m.present)
    .map((m) => ({ memberId: m.id, present: checked.has(m.id) }));
  const allChecked = data.members.every((m) => checked.has(m.id));

  function toggle(id: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await setTeamAttendance({
          teamId: data.team.id,
          changes,
        });
        const asked = {
          marked: changes.filter((c) => c.present).length,
          unmarked: changes.filter((c) => !c.present).length,
        };
        const parts = [
          result.marked ? `${plural(result.marked, "member")} marked` : null,
          result.unmarked ? `${result.unmarked} un-marked` : null,
        ].filter(Boolean);
        // A shortfall means another volunteer got there first.
        const raced =
          result.marked < asked.marked || result.unmarked < asked.unmarked;
        toast.success(
          `${data.team.teamName} | ${parts.join(", ") || "saved"}`,
          {
            description: raced
              ? "Some were already updated by another volunteer."
              : undefined,
          },
        );
        onDone(result.members);
      } catch (cause) {
        toast.error(
          cause instanceof Error ? cause.message : "Could not save attendance",
        );
      }
    });
  }

  const payment = data.paymentVerified ? (
    <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
      <BadgeCheck aria-hidden className="size-4 shrink-0" />
      Payment verified
    </p>
  ) : (
    <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      Please manually verify
    </p>
  );

  const qualification =
    data.qualification === "qualified" ? (
      <p className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
        <BadgeCheck aria-hidden className="size-4 shrink-0" />
        Qualified for ISD-2
      </p>
    ) : data.qualification === "not_qualified" ? (
      <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
        <Ban aria-hidden className="size-4 shrink-0" />
        Not qualified | do not admit
      </p>
    ) : null;
  // The server refuses the save too; hiding the roster keeps the door honest.
  const blocked = data.qualification === "not_qualified";

  const list = blocked ? null : (
    <ItemGroup className="gap-2">
      {data.members.map((member) => {
        const id = `attendance-${member.id}`;
        const on = checked.has(member.id);
        return (
          <Item key={member.id} asChild variant="outline" size="sm">
            <label
              htmlFor={id}
              className="min-h-14 cursor-pointer has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full">
                  <span className="truncate">{member.name}</span>
                  {member.isLeader ? (
                    <Badge variant="secondary" className="shrink-0">
                      Leader
                    </Badge>
                  ) : null}
                </ItemTitle>
                <ItemDescription className="tabular-nums">
                  {member.raNumber}
                  {member.present && member.scannedAt ? (
                    <>
                      {" | "}
                      {member.scannedByName ?? "Someone"} at{" "}
                      {time.format(new Date(member.scannedAt))}
                    </>
                  ) : null}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Checkbox
                  id={id}
                  checked={on}
                  disabled={pending}
                  onCheckedChange={(value) => toggle(member.id, value === true)}
                  className="size-6"
                  aria-label={`${member.name} present`}
                />
              </ItemActions>
            </label>
          </Item>
        );
      })}
    </ItemGroup>
  );

  const actions = blocked ? (
    <Button size="lg" variant="outline" onClick={onClose}>
      Close
    </Button>
  ) : (
    <>
      <Button
        size="lg"
        disabled={pending || changes.length === 0}
        onClick={save}
      >
        {pending ? <Spinner /> : null}
        {changes.length === 0
          ? "No changes"
          : `Save ${plural(changes.length, "change")}`}
      </Button>
      <Button
        size="lg"
        variant="outline"
        disabled={pending || allChecked}
        onClick={() => setChecked(new Set(data.members.map((m) => m.id)))}
      >
        <CheckCheck aria-hidden />
        Mark all present
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col gap-3 overflow-y-auto px-4">
          {payment}
          {qualification}
          {list}
        </div>
        <DrawerFooter>{actions}</DrawerFooter>
      </>
    );
  }

  return (
    <>
      {payment}
      {qualification}
      {list}
      <DialogFooter className="sm:flex-row-reverse sm:justify-start">
        {actions}
      </DialogFooter>
    </>
  );
}
