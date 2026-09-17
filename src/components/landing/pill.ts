/** Shared pill button classes (Figma: Register / Log In / Register Now buttons). */
export const pillBase =
  "inline-flex items-center rounded-full text-lg font-semibold capitalize leading-5 tracking-[-0.36px] transition-colors";

export const solidPill = `${pillBase} bg-primary px-5 py-4 text-background hover:bg-primary/90`;

export const outlinePill = `${pillBase} border-[3px] border-foreground px-[17px] py-[13px] text-foreground hover:bg-foreground/10`;

/** Login screen CTA (Figma 45:18 — 238x49, 24px label). Sized apart from
 * `pillBase` because its `text-lg` and a `text-2xl` override sit in the same
 * Tailwind layer, so the winner would depend on stylesheet order. */
export const loginPill =
  "inline-flex items-center rounded-full bg-primary px-4 py-[10px] text-2xl font-semibold leading-[29px] tracking-[-0.36px] text-background transition-colors hover:bg-primary/90 disabled:opacity-60";
