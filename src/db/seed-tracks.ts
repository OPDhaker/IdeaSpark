/**
 * The tracks a team picks from at registration, in the order they should read.
 *
 * Like `OFFICIAL_DEPARTMENTS`, this is the source of truth rather than an env
 * var: the list is public-facing copy (it lands on `/tracks` and in the
 * registration dropdown), so it belongs in review, not in Doppler.
 * `IDEASPARK_TRACKS` still overrides it for a throwaway branch.
 */
export const OFFICIAL_TRACKS = [
  "Generative AI",
  "Fin tech",
  "Healthcare",
  "Automation using IOT",
  "Agritech",
  "Open Innovation",
] as const;
