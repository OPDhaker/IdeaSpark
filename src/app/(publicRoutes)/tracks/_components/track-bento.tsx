"use client";

import { animate, createAnimatable, createScope } from "animejs";
import {
  Cpu,
  HeartPulse,
  Landmark,
  Lightbulb,
  type LucideIcon,
  Sparkles,
  Sprout,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import "./track-bento.css";

export type BentoTrack = {
  id: string;
  name: string;
};

type TrackBentoProps = {
  tracks: BentoTrack[];
  /** Clamp the title to a fixed number of lines so cells stay even. */
  textAutoHide?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
};

const DEFAULT_SPOTLIGHT_RADIUS = 300;

/** `tracks` has no icon column, so the icon is a UI concern keyed on `name`
 * (the table's unique column). A renamed track — or an `IDEASPARK_TRACKS`
 * override that seeds names only — falls back instead of rendering nothing. */
const TRACK_ICONS: Record<string, LucideIcon> = {
  "generative ai": Sparkles,
  "fin tech": Landmark,
  healthcare: HeartPulse,
  "automation using iot": Cpu,
  agritech: Sprout,
  "open innovation": Lightbulb,
};

/** The desktop bento: two 2x2 features with 1x1 cells around them, on a 4x3
 * grid. Applied only when the DB holds exactly this many active tracks — any
 * other count falls back to an even grid rather than a hole-punched one. */
const BENTO_CELLS = [
  "",
  "",
  "lg:col-span-2 lg:row-span-2",
  "lg:col-start-1 lg:col-span-2 lg:row-start-2 lg:row-span-2",
  "",
  "lg:col-start-4 lg:row-start-3",
];

export function TrackBento({
  tracks,
  textAutoHide = false,
  enableSpotlight = false,
  enableBorderGlow = true,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = false,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
}: TrackBentoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || disableAnimations || isMobile) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scope = createScope({ root }).add(() => {
      const cards = Array.from(
        root.querySelectorAll<HTMLElement>(".track-card"),
      );
      const teardowns: Array<() => void> = [];

      // One animatable per card drives both the tilt and the magnetic drift, so
      // the two never queue competing tweens on the same transform.
      const leans = new Map<HTMLElement, ReturnType<typeof createAnimatable>>();
      if (enableTilt || enableMagnetism) {
        for (const card of cards) {
          leans.set(
            card,
            createAnimatable(card, {
              rotateX: { duration: 200 },
              rotateY: { duration: 200 },
              x: { duration: 300 },
              y: { duration: 300 },
              ease: "outQuad",
            }),
          );
        }
      }

      let spotlight: HTMLDivElement | null = null;
      let follow: ReturnType<typeof createAnimatable> | null = null;
      if (enableSpotlight) {
        spotlight = document.createElement("div");
        spotlight.className = "track-spotlight";
        spotlight.setAttribute("aria-hidden", "true");
        root.appendChild(spotlight);
        follow = createAnimatable(spotlight, {
          x: { duration: 120 },
          y: { duration: 120 },
          opacity: { duration: 260 },
          ease: "outQuad",
        });
      }

      // Same proximity curve as the original: fully lit within half the radius,
      // fading out to three quarters of it.
      const proximity = spotlightRadius * 0.5;
      const fadeDistance = spotlightRadius * 0.75;
      const intensityAt = (distance: number) => {
        if (distance <= proximity) return 1;
        if (distance >= fadeDistance) return 0;
        return (fadeDistance - distance) / (fadeDistance - proximity);
      };

      const onPointerMove = (event: PointerEvent) => {
        follow?.x(event.clientX);
        follow?.y(event.clientY);

        let nearest = Number.POSITIVE_INFINITY;
        for (const card of cards) {
          const rect = card.getBoundingClientRect();
          const gap = Math.max(
            0,
            Math.hypot(
              event.clientX - (rect.left + rect.width / 2),
              event.clientY - (rect.top + rect.height / 2),
            ) -
              Math.max(rect.width, rect.height) / 2,
          );
          nearest = Math.min(nearest, gap);

          if (!enableBorderGlow) continue;
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          card.style.setProperty("--glow-x", `${x}%`);
          card.style.setProperty("--glow-y", `${y}%`);
          card.style.setProperty("--glow-radius", `${spotlightRadius}px`);
          card.style.setProperty("--glow-intensity", `${intensityAt(gap)}`);
        }

        follow?.opacity(intensityAt(nearest) * 0.8);
      };

      const onPointerLeave = () => {
        for (const card of cards) {
          card.style.setProperty("--glow-intensity", "0");
        }
        follow?.opacity(0);
      };

      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);

      for (const card of cards) {
        const onLeave = () => {
          const lean = leans.get(card);
          lean?.rotateX(0);
          lean?.rotateY(0);
          lean?.x(0);
          lean?.y(0);
        };

        const onMove = (event: PointerEvent) => {
          const lean = leans.get(card);
          if (!lean) return;
          const rect = card.getBoundingClientRect();
          const dx = event.clientX - rect.left - rect.width / 2;
          const dy = event.clientY - rect.top - rect.height / 2;
          if (enableTilt) {
            lean.rotateX((dy / (rect.height / 2)) * -10);
            lean.rotateY((dx / (rect.width / 2)) * 10);
          }
          if (enableMagnetism) {
            lean.x(dx * 0.05);
            lean.y(dy * 0.05);
          }
        };

        const onClick = (event: PointerEvent) => {
          if (!clickEffect) return;
          const rect = card.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          // Reach the furthest corner, so the ripple always covers the card.
          const radius = Math.max(
            Math.hypot(x, y),
            Math.hypot(x - rect.width, y),
            Math.hypot(x, y - rect.height),
            Math.hypot(x - rect.width, y - rect.height),
          );

          const ripple = document.createElement("div");
          ripple.className = "track-ripple";
          ripple.setAttribute("aria-hidden", "true");
          ripple.style.width = `${radius * 2}px`;
          ripple.style.height = `${radius * 2}px`;
          ripple.style.left = `${x - radius}px`;
          ripple.style.top = `${y - radius}px`;
          card.appendChild(ripple);

          animate(ripple, {
            scale: [0, 1],
            opacity: [1, 0],
            duration: 800,
            ease: "outQuad",
            onComplete: () => ripple.remove(),
          });
        };

        card.addEventListener("pointerleave", onLeave);
        card.addEventListener("pointermove", onMove);
        card.addEventListener("click", onClick);
        teardowns.push(() => {
          card.removeEventListener("pointerleave", onLeave);
          card.removeEventListener("pointermove", onMove);
          card.removeEventListener("click", onClick);
        });
      }

      // anime.js reverts the animations and animatables it created in this
      // scope; the listeners and the spotlight node are ours to undo.
      return () => {
        root.removeEventListener("pointermove", onPointerMove);
        root.removeEventListener("pointerleave", onPointerLeave);
        for (const teardown of teardowns) teardown();
        spotlight?.remove();
      };
    });

    return () => scope.revert();
  }, [
    clickEffect,
    disableAnimations,
    enableBorderGlow,
    enableMagnetism,
    enableSpotlight,
    enableTilt,
    isMobile,
    spotlightRadius,
  ]);

  return (
    <div ref={rootRef} className="relative flex flex-1 select-none lg:min-h-0">
      <div className="grid w-full flex-1 auto-rows-[minmax(200px,1fr)] gap-4 [perspective:1000px] sm:grid-cols-2 lg:min-h-0 lg:auto-rows-[minmax(min-content,1fr)] lg:grid-cols-4">
        {tracks.map((track, index) => {
          const Icon = TRACK_ICONS[track.name.toLowerCase()] ?? Lightbulb;
          const cell =
            tracks.length === BENTO_CELLS.length ? BENTO_CELLS[index] : "";
          return (
            <article
              key={track.id}
              className={`track-card ${enableBorderGlow ? "track-card--glow" : ""} ${
                textAutoHide ? "track-card--clamp" : ""
              } ${cell} relative flex h-full min-h-[200px] flex-col justify-between gap-6 overflow-hidden lg:gap-4 rounded-[32px] border border-foreground/15 bg-card p-8 transition-shadow lg:p-6`}
            >
              <header className="relative z-10 flex items-start justify-between gap-4">
                <Icon aria-hidden className="size-[28px] text-primary" />
                <span className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
                  {`Track ${String(index + 1).padStart(2, "0")}`}
                </span>
              </header>

              <div className="relative z-10 flex flex-col gap-2">
                <h2 className="track-card__title font-bold text-[clamp(1.375rem,2.2vw,28px)] text-foreground leading-tight tracking-[-0.03em]">
                  {track.name}
                </h2>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
