import { getPanelAdminData } from "@/actions/panel";
import { getAdminReviewData } from "@/app/actions";
import { getAdminActor } from "@/lib/roles";
import { AdminDashboard } from "./_components/admin-dashboard";
import { PanelsAdmin } from "./_components/panels-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const { round } = await searchParams;
  const roundId = Array.isArray(round) ? round[0] : round;

  const [data, actor] = await Promise.all([
    getAdminReviewData(),
    getAdminActor(),
  ]);

  // Panels decide who may write a score, so only a super admin sees or touches
  // them. `getPanelAdminData` enforces the same rule server-side.
  const panelData =
    actor?.role === "super_admin" ? await getPanelAdminData(roundId) : null;

  return (
    <>
      <AdminDashboard data={data} />
      {panelData ? (
        <div className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
          <PanelsAdmin data={panelData} />
        </div>
      ) : null}
    </>
  );
}
