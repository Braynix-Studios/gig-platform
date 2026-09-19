import DashboardSidebar from "@/components/DashboardSidebar";
import MobileDashboardNav from "@/components/MobileDashboardNav";
import { getSession } from "@/lib/session";
import {
  getSidebarStats,
  normalizeDisplayName,
  normalizeEmail,
} from "@/lib/dashboard-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const role = session?.role === "business" ? "business" : "developer";
  const stats = await getSidebarStats(role, session?.userId);

  return (
    <div className="min-h-dvh flex text-[var(--color-deep-ink)]">
      <DashboardSidebar
        role={role}
        user={
          session
            ? {
                name: normalizeDisplayName(session, role),
                email: normalizeEmail(session, role),
                role: session.role,
              }
            : undefined
        }
        stats={stats}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileDashboardNav
          role={role}
          userName={
            session ? normalizeDisplayName(session, role) : undefined
          }
          stats={stats}
        />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
