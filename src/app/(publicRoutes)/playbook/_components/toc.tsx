"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Heading = { id: string; text: string; level: number };

const HEADING_SELECTOR = "h2[id], h3[id]";

// The read line: a heading counts as "current" once its top has passed this
// point. 140px clears the fixed navbar and a little breathing room under it.
const READ_LINE = 140;

/**
 * Built from the rendered DOM rather than from a build-time headings export, so
 * there is nothing to keep in sync with `page.mdx`. The `id`s come from
 * `rehype-slug` (configured in `next.config.ts`).
 */
export function PlaybookToc() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const article = document.getElementById("playbook-article");
    if (!article) return;

    const elements = Array.from(
      article.querySelectorAll<HTMLHeadingElement>(HEADING_SELECTOR),
    );

    setHeadings(
      elements.map((element) => ({
        id: element.id,
        // Each heading also carries the hover permalink, so drop its trailing "#".
        text: (element.textContent ?? "").replace(/#$/, "").trim(),
        level: Number(element.tagName[1]),
      })),
    );
    if (elements.length === 0) return;

    // The last heading whose top has crossed the read line, which is the
    // section actually being read. Picking the first *intersecting* heading
    // instead leaves the mark stale inside any section taller than the
    // viewport, and this page has several.
    const sync = () => {
      let current: HTMLHeadingElement | null = null;
      for (const element of elements) {
        if (element.getBoundingClientRect().top > READ_LINE) break;
        current = element;
      }
      // Null while the reader is still on the intro, above the first heading:
      // marking a section nobody has reached yet is worse than marking none.
      setActiveId(current?.id ?? null);
    };

    // One rAF per frame at most: `scroll` fires far more often than the mark
    // can meaningfully move.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    // Runs once up front so a `/playbook#judging` load lands with the right
    // entry marked, before any scrolling happens.
    sync();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // The article keeps growing for a few frames after hydration (fonts, the
    // `<details>` blocks), which moves every heading under the read line.
    // Without this, a `#deep-link` load settles on the wrong entry.
    const resize = new ResizeObserver(onScroll);
    resize.observe(article);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // The desktop list scrolls on its own once it outgrows the viewport, so the
  // marked entry has to be kept in view. Nudging the container's own
  // `scrollTop`, rather than calling `scrollIntoView`, keeps the page scroll
  // out of it: `scrollIntoView` walks every scrollable ancestor and would
  // fight the reader's own scrolling.
  useEffect(() => {
    const box = scrollBoxRef.current;
    const node = activeRef.current;
    if (!activeId || !box || !node) return;

    const top = node.offsetTop;
    const bottom = top + node.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) {
      box.scrollTop = bottom - box.clientHeight;
    }
  }, [activeId]);

  const list = useCallback(
    (variant: "mobile" | "desktop") => (
      <ul className="border-l border-border text-sm">
        {headings.map((heading) => {
          const active = activeId === heading.id;
          return (
            <li key={heading.id}>
              <a
                ref={
                  active && variant === "desktop"
                    ? (node) => {
                        activeRef.current = node;
                      }
                    : undefined
                }
                href={`#${heading.id}`}
                aria-current={active ? "location" : undefined}
                // Closing the mobile panel on the way out means the jump lands
                // on the section instead of behind an open sheet of links.
                onClick={() => setOpen(false)}
                className={[
                  "-ml-px block border-l py-1 transition-colors",
                  heading.level === 3 ? "pl-7" : "pl-4",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    ),
    [headings, activeId],
  );

  if (headings.length === 0) return null;

  return (
    <>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="rounded-lg border border-border bg-card px-4 py-3 lg:hidden"
      >
        <summary className="cursor-pointer text-sm font-semibold">
          On this page
        </summary>
        <nav
          aria-label="On this page"
          className="mt-3 max-h-[60vh] overflow-y-auto overscroll-contain"
        >
          {list("mobile")}
        </nav>
      </details>

      <nav aria-label="On this page" className="hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        {/* `relative` makes this the offset parent the effect above measures
            the marked entry against. */}
        <div
          ref={scrollBoxRef}
          className="relative max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain"
        >
          {list("desktop")}
        </div>
      </nav>
    </>
  );
}
