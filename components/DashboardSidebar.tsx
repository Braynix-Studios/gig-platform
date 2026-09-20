"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import {
  getSidebarStatsSync,
  normalizeDisplayName,
  normalizeEmail,
} from "@/lib/dashboard-stats-defaults";

export interface DashboardStats {
  walletLabel?: string;
  walletValue?: string;
  walletSubtext?: string;
  walletHref?: string;
  reputationScore?: number;
  reputationValue?: string;
  reputationBadge?: string;
  tasksCount?: number;
  prsCount?: number;
  walletBalance?: string;
  lockedBalance?: string;
  counts?: Record<string, string>;
}

export interface DashboardSidebarProps {
  role?: "developer" | "business";
  user?: {
    name?: string;
    email?: string;
    role?: "developer" | "business";
  };
  stats?: DashboardStats;
}

const tasksIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const prsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </svg>
);

const talentIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const overviewIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const layersIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
);

const walletIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const profileIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default function DashboardSidebar({ role, user, stats }: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const detectedRole: "developer" | "business" =
    role || (pathname.startsWith("/dashboard/business") ? "business" : "developer");
  const isBusiness = detectedRole === "business";
  const base = isBusiness ? "/dashboard/business" : "/dashboard/developer";
  const currentTab = searchParams?.get("tab") || (isBusiness ? "tasks-backlog" : "tasks");

  const defaults = getSidebarStatsSync(isBusiness ? "business" : "developer");
  const s: DashboardStats = {
    ...defaults,
    ...(stats ?? {}),
    counts: { ...(defaults.counts ?? {}), ...(stats?.counts ?? {}) },
  };

  if (s.lockedBalance && !stats?.walletSubtext) {
    s.walletSubtext = isBusiness
      ? `${s.lockedBalance} locked in bounties`
      : `${s.lockedBalance} locked in escrow`;
  }

  if (isBusiness) {
    s.reputationBadge = undefined;
  } else if (!s.reputationBadge) {
    s.reputationBadge = "TOP 2%";
  }

  const reputationVal = isBusiness
    ? undefined
    : (s.reputationScore !== undefined ? String(s.reputationScore) : undefined) ?? s.reputationValue;
  const walletVal = s.walletBalance ?? s.walletValue;

  const displayName = normalizeDisplayName(
    user ? { name: user.name ?? "", role: user.role ?? detectedRole } : undefined,
    detectedRole,
  );
  const displayEmail = normalizeEmail(
    user ? { email: user.email ?? "", role: user.role ?? detectedRole } : undefined,
    detectedRole,
  );
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isLinkActive = (itemTab: string) => currentTab === itemTab;

  const workItems = isBusiness
    ? [
        { label: "Tasks Backlog", tab: "tasks-backlog", icon: tasksIcon, count: (s.tasksCount !== undefined ? String(s.tasksCount) : undefined) ?? s.counts?.["Tasks Backlog"] ?? "8" },
        { label: "Issue Pool", tab: "issue-pool", icon: layersIcon, count: s.counts?.["Issue Pool"] ?? "0" },
        { label: "Talent Pool", tab: "talent-pool", icon: talentIcon, count: s.counts?.["Talent Pool"] ?? "42" },
        { label: "Workspace", tab: "workspace", icon: overviewIcon },
      ]
    : [
        { label: "Tasks", tab: "tasks", icon: tasksIcon, count: (s.tasksCount !== undefined ? String(s.tasksCount) : undefined) ?? s.counts?.["Tasks"] ?? "2" },
        { label: "Issue Pool", tab: "issues", icon: layersIcon, count: s.counts?.["Issue Pool"] ?? "0" },
        { label: "Verified PRs", tab: "prs", icon: prsIcon, count: (s.prsCount !== undefined ? String(s.prsCount) : undefined) ?? s.counts?.["Verified PRs"] ?? "24" },
      ];

  const accountItems = isBusiness
    ? [
        { label: "Billing/Escrow", tab: "billing", icon: walletIcon },
        { label: "Profile", tab: "profile", icon: profileIcon },
      ]
    : [
        { label: "Wallet", tab: "wallet", icon: walletIcon },
        { label: "Profile", tab: "profile", icon: profileIcon },
      ];

  const renderRow = (item: { label: string; tab: string; icon: React.ReactNode; count?: string }) => {
    const active = isLinkActive(item.tab);
    return (
      <Link
        key={item.label}
        href={`${base}?tab=${item.tab}`}
        aria-current={active ? "page" : undefined}
        className="flex items-center justify-between transition-colors"
        style={{
          borderRadius: 4,
          padding: "10px 8px",
          backgroundColor: active ? "rgba(0, 201, 80, 0.10)" : "transparent",
          color: active ? "#257b5a" : "#09090b",
          fontWeight: active ? 600 : 500,
          fontSize: "0.875rem",
        }}
      >
        <span className="flex items-center gap-3">
          <span style={{ color: active ? "#257b5a" : "#71717b" }}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        {item.count !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, backgroundColor: "#f4f4f5", border: "1px solid #e4e4e7", color: "#09090b" }}>
            {item.count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      aria-label="Dashboard Sidebar"
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-dvh select-none"
      style={{ width: 248, backgroundColor: "#f6f8f7", borderRight: "1px solid #e4e4e7" }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid #e4e4e7" }}>
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="GIG Home" style={{ color: "#00c950", fontSize: "1.875rem", fontWeight: 900, letterSpacing: "-0.08em", lineHeight: 1 }}>
            gig
          </Link>
          <span className="pill-badge inline-flex items-center gap-1.5" style={{ color: "#6048a8", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em" }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: "#6048a8", flexShrink: 0 }} aria-hidden="true" />
            {isBusiness ? "BUSINESS" : "DEVELOPER"}
          </span>
        </div>
        <div style={{ marginTop: 16, color: "#71717b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {isBusiness ? "SPONSOR WORKSPACE" : "CONTRIBUTION WORKSPACE"}
        </div>
        <div style={{ marginTop: 4, fontSize: "0.875rem", color: "#09090b", lineHeight: 1.25 }}>
          {isBusiness ? "Fund, review, and ship" : "Find, build, and earn"}
        </div>
      </div>

      <div id="profile" style={{ padding: 16, borderTop: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, backgroundColor: "#eee8ff", border: "1px solid #c8b8f1", borderRadius: 4, color: "#6048a8", fontSize: 14, fontWeight: 700 }} aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: "0.875rem", fontWeight: 600, color: "#09090b", lineHeight: 1.25 }}>{displayName}</p>
            <p className="truncate" style={{ fontSize: 12, color: "#71717b", marginTop: 2, lineHeight: 1.25 }}>{displayEmail}</p>
          </div>
        </div>
        {!isBusiness && reputationVal && (
          <div className="inline-flex items-center gap-1.5" style={{ marginTop: 12, backgroundColor: "rgba(0, 201, 80, 0.10)", border: "1px solid rgba(0, 201, 80, 0.20)", color: "#257b5a", fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "4px 12px" }} title={`Reputation ${reputationVal}${s.reputationBadge ? ` · ${s.reputationBadge}` : ""}`}>
            <span aria-hidden="true">★</span>
            <span>{reputationVal}{s.reputationBadge ? ` · ${s.reputationBadge}` : ""}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 8, borderTop: "1px solid #e4e4e7" }} aria-label="Workspace Navigation">
        <div style={{ color: "#71717b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", padding: "0 8px 6px 8px" }}>WORK</div>
        <div className="space-y-1">{workItems.map(renderRow)}</div>
        <div style={{ color: "#71717b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", padding: "16px 8px 6px 8px" }}>ACCOUNT</div>
        <div className="space-y-1">{accountItems.map(renderRow)}</div>
      </nav>

      <div style={{ padding: 8, borderTop: "1px solid #e4e4e7" }}>
        {walletVal && (
          <Link href={`${base}?tab=${isBusiness ? "billing" : "wallet"}`} className="block transition-shadow hover:shadow-xs" style={{ backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 12, padding: 16 }}>
            <span className="block" style={{ color: "#71717b", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>{s.walletLabel?.toUpperCase()}</span>
            <span className="block mt-1" style={{ color: "#257b5a", fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{walletVal}</span>
            {s.walletSubtext && <span className="block mt-1" style={{ color: "#71717b", fontSize: 11, lineHeight: 1.3 }}>{s.walletSubtext}</span>}
          </Link>
        )}
        <Link href={`${base}?tab=${isBusiness ? "tasks-backlog" : "tasks"}`} className="mt-2 w-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style={{ height: 44, backgroundColor: "#00c950", color: "#f0fdf4", fontWeight: 700, fontSize: "0.875rem", letterSpacing: "0.02em", borderRadius: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <span>{isBusiness ? "POST TASK" : "CLAIM ISSUE"}</span>
        </Link>
        <form action={logoutAction} className="mt-2" style={{ borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
          <button type="submit" aria-label="Sign Out" className="w-full flex items-center justify-center gap-2 py-1 text-sm font-medium cursor-pointer transition-colors hover:text-zinc-900" style={{ color: "#71717b" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}