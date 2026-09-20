import { getPanelAdminData } from "@/actions/panel";
import { PanelsAdmin } from "./panels-admin";

export const dynamic = "force-dynamic";

export default async function AdminPanelsPage({
  searchParams,
}: PageProps<"/admin/panels">) {
  const { round } = await searchParams;
  const roundId = Array.isArray(round) ? round[0] : round;

  // `getPanelAdminData` is `requireAdminRole(["super_admin"])`, so this throws
  // for anyone else — the hidden nav row is presentation only.
  const data = await getPanelAdminData(roundId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <PanelsAdmin data={data} />
    </div>
  );
}
