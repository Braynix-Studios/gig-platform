import { DashboardShellSkeleton } from "@/components/skeletons";

// Shown automatically during navigation to any /dashboard/* route while
// the server layout + page resolve.
export default function DashboardLoading() {
  return <DashboardShellSkeleton />;
}
