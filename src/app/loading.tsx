import { FlickerLoader } from "@/components/ui/flicker-loader";

/**
 * The app's only loading UI, and it is genuinely global.
 *
 * A `loading.tsx` boundary cannot cover runtime data awaited by the layout in
 * its *own* segment, but it does wrap every nested `layout.tsx` below it. The
 * segment-mate here is `src/app/layout.tsx`, which only sets fonts and metadata
 * and awaits nothing — so the auth round trips in the dashboard, panel and
 * admin shells all sit inside this boundary and get the spinner.
 */
export default function Loading() {
  return (
    // `flex-1`, not `min-h-dvh`: `body` is already `min-h-full flex flex-col`.
    <div className="flex flex-1 items-center justify-center p-8">
      {/* Held back 120ms so a route that resolves in ~17ms — the landing page —
          swaps in before the loader is ever visible, instead of flashing it. */}
      <div className="animate-[loader-fade-in_200ms_ease-out_120ms_both] motion-reduce:animate-none">
        <FlickerLoader />
      </div>
    </div>
  );
}
