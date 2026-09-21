import { redirect } from "next/navigation";
import { getSubmissionState } from "@/app/actions";
import { ActionCard } from "./_components/action-card";
import { TemplateCard } from "./_components/template-card";
import { TrackCard } from "./_components/track-card";
import { WhatsappCard } from "./_components/whatsapp-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard | IdeaSpark 3.0",
};

export default async function TeamDashboardPage() {
  const state = await getSubmissionState();
  // No team yet — registration is the only thing that makes sense to show.
  if (!state) redirect("/register");

  return (
    // The panel's own padding plus the 19rem sidebar puts this column where the
    // wireframe puts it. Note `--spacing` is 0.23rem here, not Tailwind's
    // default 0.25 — `gap-16` is the wireframe's ~57px gutter.
    <div className="p-6 md:p-12">
      <div className="mx-auto grid w-full gap-4">
        <TemplateCard
          templateUrl={state.templateUrl}
          submission={state.submission}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <ActionCard state={state} />
          <TrackCard state={state} />
        </div>

        {/* Outside `ActionCard` — the only card that swaps — so it survives
            every lifecycle state, including `rejected` and "no round open". */}
        <WhatsappCard />
      </div>
    </div>
  );
}
