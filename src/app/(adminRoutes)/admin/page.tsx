import { getAdminReviewData } from "@/app/actions";
import { AdminDashboard } from "./_components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getAdminReviewData();
  return <AdminDashboard data={data} />;
}
