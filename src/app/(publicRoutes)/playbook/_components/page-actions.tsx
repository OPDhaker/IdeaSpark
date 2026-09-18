"use client";

import { Check, Copy, FileText, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MARKDOWN_URL = "/playbook/playbook.md";

type CopyState = "idle" | "copied" | "failed";

/**
 * `/playbook/playbook.md` serves the `page.mdx` source verbatim, so copying the
 * page is a fetch rather than a DOM-to-Markdown serializer.
 */
export function PlaybookActions() {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copyMarkdown() {
    try {
      const response = await fetch(MARKDOWN_URL);
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
        : "Copy as Markdown";

  return (
    <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-border pt-6">
      <Button type="button" variant="outline" size="sm" onClick={copyMarkdown}>
        {state === "copied" ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Copy aria-hidden className="size-4" />
        )}
        {label}
      </Button>

      <Button asChild variant="ghost" size="sm">
        <a href={MARKDOWN_URL}>
          <FileText aria-hidden className="size-4" />
          View as Markdown
        </a>
      </Button>

      <Button asChild variant="ghost" size="sm">
        <a href="/playbook/llms.txt">
          <Sparkles aria-hidden className="size-4" />
          llms.txt
        </a>
      </Button>

      <p aria-live="polite" className="sr-only">
        {state === "copied" ? "Page copied to the clipboard." : ""}
        {state === "failed" ? "Could not copy the page." : ""}
      </p>
    </div>
  );
}
