"use client";

import { ArrowUpRight, Check, ChevronDown, Copy, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AiMark } from "@/components/landing/ai-marks";
import { pillBase } from "@/components/landing/pill";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { askAiLinks, askAiPrompt, SITE_URL } from "@/lib/ask-ai";

type CopyState = "idle" | "copied" | "failed";

/** The outline pill, plus the two states a plain link never has: a chevron
 * that flips while the menu is up, and a focus ring. `pillBase` already sets
 * `inline-flex items-center`, so this composes with `asChild`. */
const trigger = `${pillBase} group gap-2 border-[3px] border-foreground px-[17px] py-[13px] text-foreground shadow-none transition-all hover:bg-foreground/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-foreground/10 motion-safe:hover:-translate-y-px`;

/**
 * The hero's "Ask AI" control. Hero itself stays a server component — this is
 * the only part that needs the client, the way `Navbar` is split off too.
 */
export function AskAi() {
  const [state, setState] = useState<CopyState>("idle");
  const [origin, setOrigin] = useState(SITE_URL);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `window` is not there on the server, and the production origin is not the
  // dev one, so the deep links are built after mount rather than at render.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(askAiPrompt(origin));
      setState("copied");
    } catch {
      setState("failed");
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={trigger}>
            <Sparkles aria-hidden className="size-[18px] text-primary" />
            Ask AI
            <ChevronDown
              aria-hidden
              className="size-[15px] text-foreground/60 transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={10}
          className="w-64 data-[state=open]:[animation:menu-in_140ms_ease-out] motion-reduce:data-[state=open]:[animation:none]"
        >
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Ask about IdeaSpark in…
          </DropdownMenuLabel>

          {askAiLinks(origin).map((link) => (
            <DropdownMenuItem key={link.id} asChild>
              <a href={link.href} target="_blank" rel="noreferrer noopener">
                <AiMark id={link.id} className="size-[18px] text-foreground" />
                <span className="flex-1 font-medium">{link.name}</span>
                <ArrowUpRight aria-hidden className="size-[14px]" />
              </a>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(event) => {
              // Keep the menu open long enough for the label to confirm the copy.
              event.preventDefault();
              void copyPrompt();
            }}
          >
            {state === "copied" ? (
              <Check aria-hidden className="size-[18px] text-primary" />
            ) : (
              <Copy aria-hidden className="size-[18px]" />
            )}
            {state === "copied"
              ? "Prompt copied"
              : state === "failed"
                ? "Copy failed"
                : "Copy prompt instead"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <p aria-live="polite" className="sr-only">
        {state === "copied" ? "Prompt copied to the clipboard." : ""}
        {state === "failed" ? "Could not copy the prompt." : ""}
      </p>
    </>
  );
}
