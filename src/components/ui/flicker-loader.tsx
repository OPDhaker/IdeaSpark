import { FlickerSpinner } from "flicker-dot";

/**
 * Ordered frames for the dot-grid loader, designed at flicker.laurie.fyi.
 *
 * Each frame is a FLAT 49-boolean array indexed `row * 7 + col` — the one shape
 * `flicker-dot` accepts. Laid out seven per line so the source reads as the
 * 7x7 grid it actually is.
 */
// biome-ignore format: the 7x7 line layout is the point
const grids = [
  [
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, true,  false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
  ],
  [
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, true,  false, false, false,
    false, false, true,  true,  true,  false, false,
    false, false, false, true,  false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
  ],
  [
    false, false, false, false, false, false, false,
    false, false, false, true,  false, false, false,
    false, false, true,  false, true,  false, false,
    false, true,  false, true,  false, true,  false,
    false, false, true,  false, true,  false, false,
    false, false, false, true,  false, false, false,
    false, false, false, false, false, false, false,
  ],
  [
    false, false, true,  true,  true,  false, false,
    false, true,  true,  false, true,  true,  false,
    true,  true,  false, true,  false, true,  true,
    true,  false, true,  false, true,  false, true,
    true,  true,  false, true,  false, true,  true,
    false, true,  true,  false, true,  true,  false,
    false, false, true,  true,  true,  false, false,
  ],
  [
    false, true,  true,  false, true,  true,  false,
    true,  true,  false, true,  false, true,  true,
    true,  false, true,  false, true,  false, true,
    false, true,  false, false, false, true,  false,
    true,  false, true,  false, true,  false, true,
    true,  true,  false, true,  false, true,  true,
    false, true,  true,  false, true,  true,  false,
  ],
  [
    true,  true,  false, true,  false, true,  true,
    true,  false, true,  false, true,  false, true,
    false, true,  false, false, false, true,  false,
    true,  false, false, false, false, false, true,
    false, true,  false, false, false, true,  false,
    true,  false, true,  false, true,  false, true,
    true,  true,  false, true,  false, true,  true,
  ],
  [
    true,  false, true,  false, true,  false, true,
    false, true,  false, false, false, true,  false,
    true,  false, false, false, false, false, true,
    false, false, false, false, false, false, false,
    true,  false, false, false, false, false, true,
    false, true,  false, false, false, true,  false,
    true,  false, true,  false, true,  false, true,
  ],
  [
    true,  true,  false, false, false, true,  true,
    true,  false, false, false, false, false, true,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    true,  false, false, false, false, false, true,
    true,  true,  false, false, false, true,  true,
  ],
  [
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
    false, false, false, false, false, false, false,
  ],
];

/**
 * The Flicker spinner in the project's own colours.
 *
 * `onColor` / `offColor` take any CSS colour, `var()` included, and the
 * package drops them onto the SVG as custom properties — so the token does the
 * light/dark switch on its own and no hex is duplicated out of `globals.css`.
 *
 * Renders on the server: the package calls `useId`, which React 19 exports from
 * its `react-server` build, so no "use client" boundary is needed here.
 */
export function FlickerLoader({ size = 64 }: { size?: number }) {
  return (
    <FlickerSpinner
      grids={grids}
      onColor="var(--destructive)"
      offColor="color-mix(in oklab, var(--destructive) 22%, transparent)"
      size={size}
      title="Loading"
    />
  );
}
