"use client";

import { useEffect, useState } from "react";

type Heading = { id: string; text: string; level: number };

const HEADING_SELECTOR = "h2[id], h3[id]";

/**
 * Built from the rendered DOM rather than from a build-time headings export, so
 * there is nothing to keep in sync with `page.mdx`. The `id`s come from
 * `rehype-slug` (configured in `next.config.ts`).
 */
export function PlaybookToc() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const article = document.getElementById("playbook-article");
    if (!article) return;

    const elements = Array.from(
      article.querySelectorAll<HTMLHeadingElement>(HEADING_SELECTOR),
    );

    const found = elements.map((element) => ({
      id: element.id,
      // Each heading also carries the hover permalink, so drop its trailing "#".
      text: (element.textContent ?? "").replace(/#$/, "").trim(),
      level: Number(element.tagName[1]),
    }));

    setHeadings(found);
    if (found.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting);
        }
        const current = found.find((heading) => visible.get(heading.id));
        if (current) setActiveId(current.id);
      },
      // Bias the band towards the top of the viewport so the mark follows the
      // section being read, not one scrolling in from below. The top inset
      // clears the fixed navbar.
      { rootMargin: "-120px 0px -70% 0px" },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  const list = (
    <ul className="border-l border-border text-sm">
      {headings.map((heading) => {
        const active = activeId === heading.id;
        return (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={active ? "location" : undefined}
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
  );

  return (
    <>
      <details className="rounded-lg border border-border bg-card px-4 py-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">
          On this page
        </summary>
        <nav aria-label="On this page" className="mt-3">
          {list}
        </nav>
      </details>

      <nav aria-label="On this page" className="hidden lg:block">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </p>
        {list}
      </nav>
    </>
  );
}
