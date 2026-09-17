"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { solidPill } from "@/components/landing/pill";
import type { CtaState } from "@/lib/auth/cta";

const cta: Record<CtaState, { href: string; label: string }> = {
  "signed-out": { href: "/register", label: "Register Now" },
  "no-team": { href: "/register", label: "Register Now" },
  "has-team": { href: "/dashboard", label: "Go to Dashboard" },
};

export function CtaBanner({ ctaState }: { ctaState: CtaState }) {
  // The loop plays at every size; reduced-motion users get the poster frame
  // instead, so the <video> is unmounted and stops loading for them.
  const [showVideo, setShowVideo] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => setShowVideo(!reduced.matches);
    update();

    reduced.addEventListener("change", update);
    return () => reduced.removeEventListener("change", update);
  }, []);

  return (
    <section className="w-full bg-background px-6 py-[32px] md:px-[min(6.875vw,88px)]">
      <div className="mx-auto w-full max-w-section">
        <div className="relative isolate flex h-[clamp(260px,27.03vw,346px)] items-end justify-center overflow-hidden rounded-[32px] bg-muted p-6 md:p-[32px]">
          <Image
            src="/landing/cta-poster.webp"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 88vw"
            className="-z-10 object-cover"
          />
          {showVideo && (
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/landing/cta-poster.webp"
              aria-hidden
              className="absolute inset-0 -z-10 size-full object-cover"
            >
              <source src="/landing/cta-loop.mp4" type="video/mp4" />
            </video>
          )}

          <Link href={cta[ctaState].href} className={solidPill}>
            {cta[ctaState].label}
          </Link>
        </div>
      </div>
    </section>
  );
}
