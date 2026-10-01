"use client";

import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useIsMobile } from "@/hooks/use-mobile";

const TITLE = "Judges can't open this link";
const DESCRIPTION =
  "Your deck is restricted, or shared only with SRM accounts. Make it public, then check again.";

const STEPS = [
  "Open your deck.",
  "Click Share.",
  "Under General access, pick “Anyone with the link”.",
  "Set the role to Viewer.",
];

/**
 * Shown when the submit-time Drive check finds the deck private. Fixing the
 * sharing keeps the same URL, so "Check again" re-runs the submit with what the
 * team already typed; nothing has to be pasted twice.
 *
 * Bottom sheet on phones, dialog on wider screens, like the attendance sheet.
 */
export function RestrictedLinkDialog({
  open,
  onOpenChange,
  link,
  checking,
  onCheckAgain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: string;
  checking: boolean;
  onCheckAgain: () => void;
}) {
  const isMobile = useIsMobile();

  const steps = (
    <ol className="list-decimal space-y-2 pl-5 text-sm marker:text-muted-foreground">
      {STEPS.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );

  const actions = (
    <>
      <Button size="lg" disabled={checking} onClick={onCheckAgain}>
        {checking ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <RefreshCw aria-hidden />
        )}
        {checking ? "Checking…" : "Check again"}
      </Button>
      <Button size="lg" variant="outline" asChild>
        {/* A plain anchor, not `next/link`: the deck lives on Drive. */}
        <a href={link} target="_blank" rel="noreferrer noopener">
          Open my deck
          <ExternalLink aria-hidden />
        </a>
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-serif text-2xl">{TITLE}</DrawerTitle>
            <DrawerDescription>{DESCRIPTION}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4">{steps}</div>
          <DrawerFooter>{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{TITLE}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        {steps}
        <DialogFooter className="sm:flex-row-reverse sm:justify-start">
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
