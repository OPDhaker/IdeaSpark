"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "schedule", label: "Schedule" },
  { id: "eligibility", label: "Eligibility" },
  { id: "rules", label: "Rules" },
  { id: "judging", label: "Judging" },
  { id: "prizes", label: "Prizes" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

export function TableOfContents() {
  const [current, setCurrent] = useState(sections[0].id);

  useEffect(() => {
    let scrollQueued = false;

    function updateCurrent() {
      let active = sections[0].id;
      for (const { id } of sections) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= 150) active = id;
      }
      // Highlight the last section when scrolled to the bottom
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4
      ) {
        active = sections[sections.length - 1].id;
      }
      setCurrent(active);
      scrollQueued = false;
    }

    function handleScroll() {
      if (!scrollQueued) {
        scrollQueued = true;
        requestAnimationFrame(updateCurrent);
      }
    }

    updateCurrent();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateCurrent);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateCurrent);
    };
  }, []);

  return (
    <nav aria-label="Table of contents">
      <h2 className="mb-[11px] text-[8px] leading-[14px] font-bold tracking-[0.8px] uppercase">
        On this page
      </h2>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={current === section.id ? "location" : undefined}
          className="block border-l border-(--pb-line) py-[3px] pl-[11px] text-[9px] leading-[15px] text-(--pb-muted) hover:border-(--pb-muted) hover:text-(--pb-text) aria-[current=location]:border-(--pb-muted) aria-[current=location]:text-(--pb-text)"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
