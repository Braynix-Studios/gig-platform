import { DashboardPageSkeleton } from "@/components/skeletons";

// Shown automatically during navigation to any /dashboard/* route while
// the server layout + page resolve. Renders within DashboardLayout's <main>
// without duplicating the sidebar.
export default function DashboardLoading() {
  return <DashboardPageSkeleton />;
}
