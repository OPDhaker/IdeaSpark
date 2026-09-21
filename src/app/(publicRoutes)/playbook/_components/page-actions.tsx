"use client";

import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  askAiLinks,
  PLAYBOOK_MARKDOWN_PATH as MARKDOWN_PATH,
  SITE_URL,
} from "@/lib/ask-ai";

const LLMS_PATH = "/playbook/llms.txt";

type CopyState = "idle" | "copied" | "failed";

/**
 * The toolbar above the article. `/playbook/playbook.md` serves the `page.mdx`
 * source verbatim, so every item here is a link to that one file: copying the
 * page is a fetch rather than a DOM-to-Markdown serializer, and the two LLM
 * items hand the same URL to a model instead of asking it to scrape the page.
 */
export function PlaybookActions() {
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

  async function copyMarkdown() {
    try {
      const response = await fetch(MARKDOWN_PATH);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await navigator.clipboard.writeText(await response.text());
      setState("copied");
    } catch {
      setState("failed");
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const label =
    state === "copied"
      ? "Copied"
      : state === "failed"
        ? "Copy failed"
        : "Copy page";

  // Shared with the hero's Ask AI menu so the two prompts cannot drift; this
  // toolbar deliberately surfaces only the two providers it always has.
  const links = askAiLinks(origin);
  const chatgpt = links.find((link) => link.id === "chatgpt");
  const claude = links.find((link) => link.id === "claude");

  return (
    <div className="flex items-center gap-px">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyMarkdown}
        className="rounded-r-none"
      >
        {state === "copied" ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
        {label}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="More ways to read this page"
            className="rounded-l-none px-2"
          >
            <ChevronDown aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={copyMarkdown}>
            <Copy aria-hidden className="size-4" />
            Copy as Markdown
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a href={MARKDOWN_PATH}>
              <FileText aria-hidden className="size-4" />
              View as Markdown
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <a href={LLMS_PATH}>
              <Sparkles aria-hidden className="size-4" />
              llms.txt
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {chatgpt ? (
            <DropdownMenuItem asChild>
              <a href={chatgpt.href} target="_blank" rel="noreferrer noopener">
                <ExternalLink aria-hidden className="size-4" />
                Open in ChatGPT
              </a>
            </DropdownMenuItem>
          ) : null}

          {claude ? (
            <DropdownMenuItem asChild>
              <a href={claude.href} target="_blank" rel="noreferrer noopener">
                <ExternalLink aria-hidden className="size-4" />
                Open in Claude
              </a>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <p aria-live="polite" className="sr-only">
        {state === "copied" ? "Page copied to the clipboard." : ""}
        {state === "failed" ? "Could not copy the page." : ""}
      </p>
    </div>
  );
}
