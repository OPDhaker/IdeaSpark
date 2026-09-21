"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { CtaState } from "@/lib/auth/cta";
import { useSignOut } from "@/lib/auth/use-sign-out";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/playbook", label: "Playbook" },
  { href: "/tracks", label: "Tracks" },
];

const linkClass =
  "capitalize font-semibold text-base leading-5 tracking-[-0.32px] text-foreground hover:opacity-70 transition-opacity";

const cta: Record<CtaState, { href: string; label: string }> = {
  "signed-out": { href: "/login", label: "Log In" },
  "no-team": { href: "/register", label: "Register" },
  "has-team": { href: "/dashboard", label: "Dashboard" },
};

export function Navbar({ ctaState }: { ctaState: CtaState }) {
  const [open, setOpen] = useState(false);
  const { signOut, pending } = useSignOut();

  // "no-team" and "has-team" both mean there is a session to end.
  const signedIn = ctaState !== "signed-out";

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-8">
      <nav aria-label="Main" className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between rounded-full border-[0.2px] border-foreground bg-foreground/10 py-2 pl-4 pr-2 backdrop-blur-[6px] md:pl-9 md:pr-[9px]">
          <Link href="/" className="flex size-12 items-center justify-center">
            <Image
              src="/fc-icons/logo.svg"
              alt="IdeaSpark logo"
              width={32}
              height={48}
              className="h-12 w-8 object-contain"
              priority
            />
          </Link>

          <div className="hidden items-center gap-4 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Link
              href={cta[ctaState].href}
              className="rounded-full bg-primary px-4 py-3 text-base font-semibold capitalize leading-5 tracking-[-0.36px] text-background transition-colors hover:bg-primary/90 md:px-5 md:py-4 md:text-lg"
            >
              {cta[ctaState].label}
            </Link>

            {signedIn ? (
              // Icon-only, so it needs an explicit name. Hidden on mobile —
              // the right cluster is already tight there, and the sheet below
              // carries a labelled row instead.
              <button
                type="button"
                onClick={signOut}
                disabled={pending}
                aria-label="Sign out"
                title="Sign out"
                className="hidden size-12 items-center justify-center rounded-full text-destructive bg-destructive/20 transition-colors hover:bg-destructive/30 disabled:opacity-60 md:flex"
              >
                <LogOut aria-hidden className="size-5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label="Toggle navigation"
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 md:hidden"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-6"
              >
                {open ? (
                  <>
                    <line x1="5" y1="5" x2="19" y2="19" />
                    <line x1="19" y1="5" x2="5" y2="19" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="17" x2="20" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div
          id="mobile-nav"
          hidden={!open}
          className="mt-2 flex flex-col gap-1 rounded-3xl border-[0.2px] border-foreground bg-foreground/10 p-4 backdrop-blur-[6px] md:hidden"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`${linkClass} py-2`}
            >
              {link.label}
            </Link>
          ))}

          {signedIn ? (
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className={`${linkClass} flex items-center gap-2 py-2 text-left disabled:opacity-60`}
            >
              <LogOut aria-hidden className="size-5" />
              {pending ? "Signing out…" : "Sign Out"}
            </button>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
