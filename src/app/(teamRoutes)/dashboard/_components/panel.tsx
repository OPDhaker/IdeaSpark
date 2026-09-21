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
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-foreground/15 bg-card p-8 flex flex-col gap-4 justify-between",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-5xl leading-none tracking-tight font-serif mb-2">
      {children}
    </h2>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-muted-foreground text-base">{children}</p>;
}

/** A field on the Track Details card: small caps label over a plain value. */
export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-1 justify-between items-end border-b pb-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-base text-pretty text-right">
        {value}
      </dd>
    </div>
  );
}
