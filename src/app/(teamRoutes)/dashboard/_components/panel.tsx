import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one card shape every dashboard surface uses. Matches the `Notice` block
 * on the register page (`rounded-2xl border border-foreground/15 bg-card`) so
 * the two signed-in screens read as one design.
 *
 * Height comes from padding and content, never a fixed aspect ratio — a long
 * team name or a paragraph of reviewer remarks has to fit.
 */
export function DashCard({
  className,
  children,
  muted = false,
}: {
  className?: string;
  children: ReactNode;
  /** Demotes a card that has served its purpose, e.g. the template after acceptance. */
  muted?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-foreground/15 bg-card p-8 transition-opacity",
        muted && "opacity-60 hover:opacity-100",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-serif text-3xl leading-none tracking-[-0.02em]">
      {children}
    </h2>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-muted-foreground text-sm">{children}</p>;
}

/** A field on the Track Details card: small caps label over a plain value. */
export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] text-muted-foreground uppercase tracking-[0.12em]">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-sm">{value}</dd>
    </div>
  );
}
