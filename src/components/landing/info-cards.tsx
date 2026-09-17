"use client";

import { animate, createScope, onScroll } from "animejs";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const days = [
  {
    label: "Day 1",
    description: "Pitch your idea and fun game",
  },
  {
    label: "Day 2",
    description: "Build your prototype and present",
  },
];

export function InfoCards() {
  const [activeDay, setActiveDay] = useState(0);
  const current = days[activeDay];
  const nextDay = days[(activeDay + 1) % days.length];

  const sectionRef = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLParagraphElement>(null);
  const taglineCardRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sync = { sync: true } as const;
    const enter = { target: "top", container: "bottom" } as const;
    const leave = { target: "bottom", container: "top" } as const;

    const scope = createScope({ root: section }).add(() => {
      const taglineCard = taglineCardRef.current;
      if (watermarkRef.current && taglineCard) {
        // Scrubbed against the tagline card's own pass through the viewport, so
        // the text is fully readable while the card is on screen: it starts
        // below the card's bottom edge and ends above its top edge.
        animate(watermarkRef.current, {
          y: ["140%", "-140%"],
          ease: "linear",
          autoplay: onScroll({
            target: taglineCard,
            enter,
            leave,
            ...sync,
          }),
        });
      }

      // Image only exists from md up (hidden below), so don't observe it on phones.
      if (imageRef.current && window.matchMedia("(min-width: 768px)").matches) {
        animate(imageRef.current, {
          y: ["0%", "72%"],
          ease: "linear",
          // The page is short, so finishing when the section's bottom reaches
          // the viewport bottom keeps the travel inside the reachable scroll.
          autoplay: onScroll({
            target: section,
            enter,
            leave: { target: "bottom", container: "bottom" },
            ...sync,
          }),
        });
      }
    });

    return () => scope.revert();
  }, []);

  return (
    <section ref={sectionRef} className="w-full px-6 py-12 md:px-16">
      <div className="mx-auto w-full max-w-section">
        <div className="grid gap-4 md:h-[736px] md:grid-cols-2">
          <div className="flex flex-col gap-4 md:h-full">
            {/* Date card */}
            <article className="relative flex min-h-[260px] flex-1 flex-col justify-end overflow-hidden rounded-[32px] p-8">
              <Image
                src="/landing/dateCard.webp"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              <p className="relative text-[clamp(1.75rem,4vw,40px)] font-bold leading-tight tracking-[-0.04em] text-accent">
                5th &amp; 6th October
              </p>
            </article>

            {/* Tagline card */}
            <article
              ref={taglineCardRef}
              className="relative flex min-h-[260px] flex-1 flex-col justify-end gap-2 overflow-hidden rounded-[32px] bg-foreground p-8"
            >
              <div className="pointer-events-none absolute inset-x-8 top-1/2 z-0 -translate-y-1/2">
                <p
                  ref={watermarkRef}
                  aria-hidden
                  className="text-[clamp(3rem,8vw,104px)] font-semibold leading-[0.83] tracking-[-0.01em] text-accent/[0.08]"
                >
                  Resolve. Ignite. Lead.
                </p>
              </div>
              <p className="relative z-10 text-center text-[clamp(1.5rem,4vw,40px)] font-bold leading-tight tracking-[-0.07em] text-accent mix-blend-hard-light">
                決意し、火をつけ、導く。
              </p>
            </article>
          </div>

          {/* Day card — clicking anywhere on it advances to the next day */}
          <article className="relative flex min-h-[260px] flex-col justify-end gap-6 overflow-hidden rounded-[32px] bg-[#381f18] p-8 md:h-full md:gap-10">
            <div
              ref={imageRef}
              className="pointer-events-none absolute inset-x-0 top-0 hidden h-[44%] md:block"
            >
              <Image
                src="/landing/d1d2.svg"
                alt=""
                fill
                sizes="50vw"
                className="object-cover object-center"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveDay((day) => (day + 1) % days.length)}
              aria-label={`Show ${nextDay.label}`}
              className="absolute inset-0 z-20 cursor-pointer rounded-[32px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />

            <div className="relative z-10 flex flex-col gap-2 text-muted">
              <p className="text-[clamp(1.75rem,4vw,40px)] font-bold leading-tight tracking-[-0.03em]">
                {current.label}
              </p>
              <p className="text-[clamp(1.125rem,3vw,32px)] font-semibold leading-tight tracking-[-0.03em]">
                {current.description}
              </p>
            </div>

            <div className="relative z-30 flex gap-2">
              {days.map((day, index) => (
                <button
                  key={day.label}
                  type="button"
                  onClick={() => setActiveDay(index)}
                  aria-label={`Show ${day.label}`}
                  aria-pressed={index === activeDay}
                  className={`size-4 rounded-full transition-colors ${
                    index === activeDay ? "bg-primary" : "bg-muted/40"
                  }`}
                />
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
