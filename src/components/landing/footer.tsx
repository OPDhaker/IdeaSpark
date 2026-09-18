import Image from "next/image";
import Link from "next/link";

const legalLinks = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/tos", label: "Terms of Service" },
];

export function Footer() {
  return (
    <footer className="relative isolate w-full overflow-hidden bg-background px-6 md:px-[min(5.625vw,72px)]">
      <Image
        src="/landing/footer.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 object-cover object-center"
      />
      {/* Fades the photo into the page background, top and bottom */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--background)_6.25%,transparent_37.5%,transparent_81.7%,var(--background)_97.6%)]" />

      <div className="mx-auto flex h-[clamp(280px,56vw,447px)] w-full max-w-section items-end">
        <p className="w-full whitespace-nowrap bg-linear-to-t from-foreground from-[22.4%] to-foreground/30 to-[46.3%] bg-clip-text font-serif text-[min(45vw,240px)] leading-none tracking-tighter text-transparent [text-box:trim-both_cap_alphabetic] sm:text-[min(20.63vw,264px)]">
          <span aria-hidden className="sm:hidden">
            FC
          </span>
          <span aria-hidden className="hidden sm:inline">
            Founders Club
          </span>
          <span className="sr-only">Founders Club</span>
        </p>
      </div>

      {/* Names the app and links the legal pages: Google's OAuth review looks
          for both on the home page, and students get a way to reach us. */}
      <div className="mx-auto flex w-full max-w-section flex-col gap-3 border-t border-foreground/15 py-6 text-sm text-foreground/70 md:flex-row md:items-center md:justify-between">
        <p>
          IdeaSpark 3.0 — Founders Club, SRM Institute of Science and Technology
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="mailto:opdhaker2007@gmail.com"
            className="hover:text-foreground"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
