import { Navbar } from "@/components/landing/navbar";
import { getActiveTracks } from "@/db/queries";
import { getCtaState } from "@/lib/auth/cta";
import { TrackBento } from "./_components/track-bento";

export const metadata = {
  title: "Tracks | IdeaSpark 3.0",
  description:
    "The six problem areas a team can build in at IdeaSpark 3.0 — pick one at registration.",
};

export default async function TracksPage() {
  const [ctaState, tracks] = await Promise.all([
    getCtaState(),
    getActiveTracks(),
  ]);

  return (
    // The grid is the whole page, so the height chain runs unbroken from here
    // down to the cards: every link is a flex column handing its spare height on.
    <div className="flex min-h-dvh flex-col bg-background lg:h-dvh">
      <Navbar ctaState={ctaState} />

      <main className="flex flex-1 flex-col px-6 pt-32 pb-12 md:px-16 lg:min-h-0">
        <div className="mx-auto flex w-full max-w-section flex-1 flex-col lg:min-h-0">
          {tracks.length === 0 ? (
            // Same wording the register page shows when nothing is seeded.
            <div className="rounded-2xl border border-foreground/15 bg-card p-8 text-center">
              <h2 className="font-semibold text-foreground text-xl">
                Tracks haven't been announced
              </h2>
              <p className="mt-2 text-muted-foreground text-sm">
                You'll be able to register once the organisers publish the
                tracks.
              </p>
            </div>
          ) : (
            <TrackBento tracks={tracks} />
          )}
        </div>
      </main>
    </div>
  );
}
