import Image from "next/image";
import Link from "next/link";
import { solidPill } from "@/components/landing/pill";
import type { CtaState } from "@/lib/auth/cta";

const cta: Record<CtaState, { href: string; label: string; heading: string }> =
  {
    "signed-out": {
      href: "/register",
      label: "Register Now",
      heading: "Got an idea? Bring it.",
    },
    "no-team": {
      href: "/register",
      label: "Register Now",
      heading: "Got an idea? Bring it.",
    },
    "has-team": {
      href: "/dashboard",
      label: "Go to Dashboard",
      heading: "Your team is in.",
    },
  };

export function CtaBanner({ ctaState }: { ctaState: CtaState }) {
  return (
    <section className="w-full bg-background px-6 py-[32px] md:px-[min(6.875vw,88px)]">
      <div className="mx-auto w-full max-w-section">
        <div className="relative isolate flex h-[clamp(260px,27.03vw,346px)] flex-col items-center justify-end gap-4 overflow-hidden rounded-[32px] bg-muted p-6 md:p-[32px]">
          <Image
            src="/landing/cta.webp"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 1152px"
            className="-z-10 object-cover"
          />
          {/* The tile is opaque black noise, so it screens rather than fades:
              its near-black pixels leave the photo alone and only the brighter
              specks land, which is what reads as grain. `overlay` and
              `soft-light` both just crush this photo's shadows into mud. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[url('/landing/cta-grain.webp')] bg-[length:256px_256px] bg-repeat opacity-25 mix-blend-screen"
          />
          {/* Holds the copy against the sunbeam in the middle of the photo */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

          {/* The photo is dark in both themes, so neither `text-foreground` nor
              `text-background` survives a theme flip here. */}
          <h2 className="text-balance text-center text-[clamp(1.75rem,4vw,44px)] font-bold leading-none tracking-[-0.04em] text-white">
            {cta[ctaState].heading}
          </h2>

          <Link href={cta[ctaState].href} className={solidPill}>
            {cta[ctaState].label}
          </Link>
        </div>
      </div>
    </section>
  );
}
