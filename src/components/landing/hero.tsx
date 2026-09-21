import Image from "next/image";
import Link from "next/link";
import { AskAi } from "@/components/landing/ask-ai";
import { outlinePill, solidPill } from "@/components/landing/pill";
import type { CtaState } from "@/lib/auth/cta";

const cta: Record<CtaState, { href: string; label: string }> = {
  "signed-out": { href: "/register", label: "Register" },
  "no-team": { href: "/register", label: "Register" },
  "has-team": { href: "/dashboard", label: "Dashboard" },
};

function VerticalLabel({
  children,
  height,
  direction,
}: {
  children: string;
  height: string;
  direction: "left" | "right";
}) {
  return (
    <div
      className={`hidden w-[23px] shrink-0 items-center justify-center md:flex ${height}`}
    >
      <p
        className={`whitespace-nowrap text-[32px] font-bold leading-5 tracking-[-0.06em] text-foreground ${
          direction === "left" ? "rotate-90" : "-rotate-90"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

export function Hero({ ctaState }: { ctaState: CtaState }) {
  return (
    <section className="relative isolate flex min-h-screen w-full flex-col justify-end overflow-x-clip bg-background px-6 pb-10 pt-32 text-foreground md:p-16 md:pt-32">
      <div className="relative mx-auto flex w-full max-w-section flex-1 flex-col justify-end">
        {/* Background art: character cutout over two blurred colour blobs */}
        <div className="pointer-events-none absolute -bottom-10 right-0 z-0 aspect-square w-[85%] max-w-[690px] opacity-40 md:-bottom-16 md:w-[54%] md:opacity-100">
          <div className="absolute left-[34%] top-[30%] aspect-square w-[33%] rounded-full bg-primary blur-[60px]" />
          <div className="absolute -bottom-[6%] left-[38%] h-[10%] w-[33%] rounded-full bg-foreground blur-[60px]" />
          <Image
            src="/landing/heroImg.svg"
            alt=""
            fill
            sizes="(max-width: 768px) 85vw, 54vw"
            className="object-contain"
            priority
          />
        </div>

        <div className="relative z-10 flex w-full items-end justify-between gap-4">
          <div className="flex flex-col items-start gap-0.5">
            <VerticalLabel height="h-[332px]" direction="left">
              ファウンダーズ・クラブ
            </VerticalLabel>

            <h1 className="text-[clamp(2.75rem,11vw,128px)] font-bold leading-none tracking-[-0.06em] text-foreground">
              IdeaSpark 3.0
            </h1>

            <div className="mt-4 flex flex-wrap items-start gap-4">
              <Link href={cta[ctaState].href} className={solidPill}>
                {cta[ctaState].label}
              </Link>
              <Link href="/playbook" className={outlinePill}>
                Playbook
              </Link>
              <AskAi />
            </div>
          </div>

          <VerticalLabel height="h-[362px]" direction="right">
            決意し、火をつけ、導く。
          </VerticalLabel>
        </div>
      </div>
    </section>
  );
}
