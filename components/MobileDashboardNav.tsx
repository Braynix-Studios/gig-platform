"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSidebarStatsSync, type DashboardStats } from "@/lib/dashboard-stats-defaults";

const dashboardIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const tasksIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const prsIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </svg>
);

const talentIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const overviewIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const layersIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
);

const walletIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const profileIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BORDER = "#e4e4e7";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";

interface MobileDashboardNavProps {
  role: "developer" | "business";
  userName?: string;
  stats?: DashboardStats;
}

export default function MobileDashboardNav({ role, userName, stats }: MobileDashboardNavProps) {
  const searchParams = useSearchParams();

  const isBusiness = role === "business";
  const base = isBusiness ? "/dashboard/business" : "/dashboard/developer";
  const currentTab = searchParams?.get("tab") || "dashboard";

  const fallback = getSidebarStatsSync(role);
  const mergedCounts = { ...fallback.counts, ...stats?.counts };
  const mergedStats = stats ? { ...fallback, ...stats, counts: mergedCounts } : fallback;

  const overviewItem = {
    label: "Dashboard",
    tab: "dashboard",
    icon: dashboardIcon,
    badge: "LIVE",
  };

  const workItems = isBusiness
    ? [
        { label: "Issue Pool", tab: "issue-pool", icon: layersIcon, count: mergedStats.counts?.["Issue Pool"] ?? "0" },
        { label: "Talent Pool", tab: "talent-pool", icon: talentIcon, count: mergedStats.counts?.["Talent Pool"] ?? "42" },
        { label: "Workspace", tab: "workspace", icon: overviewIcon },
      ]
    : [
        { label: "Issue Pool", tab: "issues", icon: layersIcon, count: mergedStats.counts?.["Issue Pool"] ?? "0" },
        { label: "Verified PRs", tab: "prs", icon: prsIcon, count: mergedStats.counts?.["Verified PRs"] ?? "24" },
      ];

  const accountItems = isBusiness
    ? [
        { label: "Tasks Backlog", tab: "tasks-backlog", icon: tasksIcon, count: mergedStats.counts?.["Tasks Backlog"] ?? "8" },
        { label: "Billing/Escrow", tab: "billing", icon: walletIcon },
        { label: "Profile", tab: "profile", icon: profileIcon },
      ]
    : [
        { label: "Tasks", tab: "tasks", icon: tasksIcon, count: mergedStats.counts?.["Tasks"] ?? "2" },
        { label: "Wallet", tab: "wallet", icon: walletIcon },
        { label: "Profile", tab: "profile", icon: profileIcon },
      ];

  const isLinkActive = (itemTab: string) => {
    return currentTab === itemTab;
  };

  const renderRow = (item: { label: string; tab: string; icon: React.ReactNode; count?: string; badge?: string }) => {
    const active = isLinkActive(item.tab);
    return (
      <Link
        key={item.label}
        href={`${base}?tab=${item.tab}`}
        aria-current={active ? "page" : undefined}
        className="flex items-center justify-between"
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          backgroundColor: active ? MINT_SOFT : "transparent",
          color: active ? "#257b5a" : CHARCOAL,
          fontWeight: active ? 700 : 500,
          fontSize: "0.875rem",
          textDecoration: "none",
        }}
      >
        <span className="flex items-center gap-3">
          <span style={{ color: active ? "#257b5a" : MUTED }}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        {item.badge ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 9999,
              backgroundColor: active ? "rgba(0, 201, 80, 0.20)" : "rgba(0, 201, 80, 0.10)",
              color: "#257b5a",
              border: "1px solid rgba(0, 201, 80, 0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: 9999, backgroundColor: "#00c950" }} />
            {item.badge}
          </span>
        ) : item.count !== undefined ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 4,
              backgroundColor: "#f4f4f5",
              border: `1px solid ${BORDER}`,
              color: CHARCOAL,
            }}
          >
            {item.count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="md:hidden border-b" style={{ borderColor: BORDER, backgroundColor: "#ffffff", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#257b5a" }}>
          {isBusiness ? "SPONSOR WORKSPACE" : "CONTRIBUTION WORKSPACE"}
        </span>
        {userName && (
          <span style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL }}>
            {userName}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ padding: "4px 0 2px", color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          OVERVIEW
        </div>
        {renderRow(overviewItem)}

        <div style={{ padding: "12px 0 2px", color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          WORK
        </div>
        {workItems.map(renderRow)}

        <div style={{ padding: "12px 0 2px", color: MUTED, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          ACCOUNT
        </div>
        {accountItems.map(renderRow)}
      </div>
    </div>
  );
}