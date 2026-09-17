"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowIcon,
  ChevronIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
} from "./icons";
import { pageMarkdown } from "./markdown";

const MARKDOWN_URL = "/playbook/playbook.md";

const assistants = [
  { name: "Claude", href: "https://claude.ai/new" },
  { name: "ChatGPT", href: "https://chatgpt.com/" },
];

const menuItemClass =
  "flex items-center gap-2.5 p-[9px] text-[11px] hover:bg-(--pb-panel)";

function assistantHref(href: string, markdown: string) {
  if (!markdown) return href;
  const url = new URL(href);
  url.searchParams.set(
    "q",
    `Read this IdeaSpark 3.0 playbook and answer my questions using only its content. Treat TODO items as unconfirmed.\n\n${markdown}`,
  );
  return url.href;
}

export function PageActions() {
  const [markdown, setMarkdown] = useState("");
  const [label, setLabel] = useState("Copy page");
  const [status, setStatus] = useState("");
  const menuRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const resetLabel = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMarkdown(pageMarkdown());

    function handleClick(event: MouseEvent) {
      const menu = menuRef.current;
      const target = event.target as Element;
      if (menu && (!menu.contains(target) || target.closest("a"))) {
        menu.open = false;
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        summaryRef.current?.focus();
      }
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(resetLabel.current);
    };
  }, []);

  async function copyPage() {
    const text = pageMarkdown();
    let copied = false;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Fallback when the Clipboard API is blocked
      const field = document.createElement("textarea");
      const focused = document.activeElement as HTMLElement | null;
      field.value = text;
      field.className = "sr-only";
      field.setAttribute("aria-label", "Playbook text");
      document.body.append(field);
      field.select();
      try {
        copied = document.execCommand("copy");
      } catch {}
      field.remove();
      focused?.focus({ preventScroll: true });
    }
    setLabel(copied ? "Copied" : "Copy failed");
    setStatus(
      copied
        ? "Playbook copied as Markdown."
        : "Copy failed. Use Download as Markdown from the page menu.",
    );
    clearTimeout(resetLabel.current);
    resetLabel.current = setTimeout(() => setLabel("Copy page"), 2000);
  }

  return (
    <>
      <div className="relative flex items-center rounded-[20px] border border-(--pb-line)">
        <button
          type="button"
          onClick={copyPage}
          className="flex h-[26px] cursor-pointer items-center justify-center gap-[7px] rounded-l-[20px] px-2.5 text-[9px] hover:bg-(--pb-panel)"
        >
          <CopyIcon className="size-[11px]" />
          <span>{label}</span>
        </button>
        <details ref={menuRef} className="group">
          <summary
            ref={summaryRef}
            aria-label="More page options"
            className="flex h-[26px] cursor-pointer list-none items-center justify-center rounded-r-[20px] border-l border-(--pb-line) px-[7px] text-[9px] hover:bg-(--pb-panel) [&::-webkit-details-marker]:hidden"
          >
            <ChevronIcon className="size-3.5 group-open:rotate-180" />
          </summary>
          <div className="absolute top-[calc(100%_+_7px)] right-0 z-5 min-w-[205px] rounded-lg border border-(--pb-line) bg-(--pb-bg) p-[5px] shadow-[0_12px_28px_rgb(0_0_0/25%)]">
            {assistants.map((assistant) => (
              <a
                key={assistant.name}
                href={assistantHref(assistant.href, markdown)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={copyPage}
                className={`${menuItemClass} rounded-[4px]`}
              >
                <ArrowIcon />
                Open in {assistant.name}
              </a>
            ))}
            <a
              href={MARKDOWN_URL}
              download="ideaspark-playbook.md"
              className={`${menuItemClass} mt-1 border-t border-(--pb-line)`}
            >
              <DownloadIcon />
              Download as Markdown
            </a>
            <a
              href={MARKDOWN_URL}
              target="_blank"
              rel="noopener"
              className={`${menuItemClass} rounded-[4px]`}
            >
              <FileIcon />
              View as Markdown
            </a>
          </div>
        </details>
      </div>
      <output className="sr-only" aria-live="polite">
        {status}
      </output>
    </>
  );
}
