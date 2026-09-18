import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-20 text-foreground md:px-16">
      <div className="mx-auto w-full max-w-[720px]">
        <Link
          href="/"
          className="text-sm font-medium text-foreground/60 hover:text-foreground"
        >
          ← IdeaSpark 3.0
        </Link>
        <h1 className="mt-6 text-[40px] font-bold leading-[1.05] tracking-[-0.04em] md:text-[56px]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-foreground/60">
          Last updated {updated}
        </p>
        <div className="mt-10 flex flex-col gap-5 text-[16px] leading-relaxed text-foreground/85 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
          {children}
        </div>
      </div>
    </main>
  );
}
