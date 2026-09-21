/** Shared pill button classes (Figma: Register / Log In / Register Now buttons). */
export const pillBase =
  "inline-flex items-center rounded-full text-lg font-semibold capitalize leading-5 tracking-[-0.36px] transition-colors";

export const solidPill = `${pillBase} bg-primary px-5 py-4 text-background hover:bg-primary/90`;

export const outlinePill = `${pillBase} border-[3px] border-foreground px-[17px] py-[13px] text-foreground hover:bg-foreground/10`;
