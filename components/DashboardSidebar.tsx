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

const dashboardIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

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
    <path d="M23 21v-2a4 4 0 0 1 0 7.75" />
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
  const currentTab = searchParams?.get("tab") || "dashboard";

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

  const overviewItem = {
    label: "Dashboard",
    tab: "dashboard",
    icon: dashboardIcon,
    badge: "LIVE",
  };

  const workItems = isBusiness
    ? [
        { label: "Issue Pool", tab: "issue-pool", icon: layersIcon, count: s.counts?.["Issue Pool"] ?? "0" },
        { label: "Talent Pool", tab: "talent-pool", icon: talentIcon, count: s.counts?.["Talent Pool"] ?? "42" },
        { label: "Workspace", tab: "workspace", icon: overviewIcon },
      ]
    : [
        { label: "Issue Pool", tab: "issues", icon: layersIcon, count: s.counts?.["Issue Pool"] ?? "0" },
        { label: "Verified PRs", tab: "prs", icon: prsIcon, count: (s.prsCount !== undefined ? String(s.prsCount) : undefined) ?? s.counts?.["Verified PRs"] ?? "24" },
      ];

  const accountItems = isBusiness
    ? [
        { label: "Tasks Backlog", tab: "tasks-backlog", icon: tasksIcon, count: (s.tasksCount !== undefined ? String(s.tasksCount) : undefined) ?? s.counts?.["Tasks Backlog"] ?? "8" },
        { label: "Billing/Escrow", tab: "billing", icon: walletIcon },
        { label: "Profile", tab: "profile", icon: profileIcon },
      ]
    : [
        { label: "Tasks", tab: "tasks", icon: tasksIcon, count: (s.tasksCount !== undefined ? String(s.tasksCount) : undefined) ?? s.counts?.["Tasks"] ?? "2" },
        { label: "Wallet", tab: "wallet", icon: walletIcon },
        { label: "Profile", tab: "profile", icon: profileIcon },
      ];

  const renderRow = (item: { label: string; tab: string; icon: React.ReactNode; count?: string; badge?: string }) => {
    const active = isLinkActive(item.tab);
    return (
      <Link
        key={item.label}
        href={`${base}?tab=${item.tab}`}
        aria-current={active ? "page" : undefined}
        className="flex items-center justify-between transition-all"
        style={{
          borderRadius: 6,
          padding: "9px 10px",
          backgroundColor: active ? "rgba(0, 201, 80, 0.12)" : "transparent",
          color: active ? "#1b6348" : "#27272a",
          fontWeight: active ? 700 : 500,
          fontSize: "0.875rem",
          borderLeft: active ? "3px solid #00c950" : "3px solid transparent",
        }}
      >
        <span className="flex items-center gap-3">
          <span style={{ color: active ? "#257b5a" : "#71717b" }}>{item.icon}</span>
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
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, backgroundColor: active ? "#ffffff" : "#f4f4f5", border: "1px solid #e4e4e7", color: "#09090b" }}>
            {item.count}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      aria-label="Dashboard Sidebar"
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-dvh select-none"
      style={{ width: 252, backgroundColor: "#f8faf9", borderRight: "1px solid #e4e4e7" }}
    >
      {/* Workspace Header */}
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #e4e4e7" }}>
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="GIG Home" style={{ color: "#00c950", fontSize: "1.875rem", fontWeight: 900, letterSpacing: "-0.08em", lineHeight: 1, textDecoration: "none" }}>
            gig
          </Link>
          <span className="pill-badge inline-flex items-center gap-1.5" style={{ color: "#257b5a", backgroundColor: "rgba(0, 201, 80, 0.10)", border: "1px solid rgba(0, 201, 80, 0.20)", padding: "3px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em" }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: "#00c950", flexShrink: 0 }} aria-hidden="true" />
            {isBusiness ? "BUSINESS" : "DEVELOPER"}
          </span>
        </div>
        <div style={{ marginTop: 14, color: "#71717b", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {isBusiness ? "SPONSOR WORKSPACE" : "CONTRIBUTION WORKSPACE"}
        </div>
        <div style={{ marginTop: 2, fontSize: "0.8125rem", color: "#3f3f46", fontWeight: 500 }}>
          {isBusiness ? "Fund, review, and ship" : "Find, build, and earn"}
        </div>
      </div>

      {/* User Profile Card */}
      <div id="profile" style={{ padding: "14px 16px", borderBottom: "1px solid #e4e4e7", backgroundColor: "#ffffff" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0" style={{ width: 38, height: 38, backgroundColor: "rgba(0, 201, 80, 0.10)", border: "1px solid rgba(0, 201, 80, 0.25)", borderRadius: 8, color: "#257b5a", fontSize: 13, fontWeight: 800 }} aria-hidden="true">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate" style={{ fontSize: "0.875rem", fontWeight: 700, color: "#09090b", lineHeight: 1.2 }}>{displayName}</p>
            <p className="truncate" style={{ fontSize: 12, color: "#71717b", marginTop: 2, lineHeight: 1.2 }}>{displayEmail}</p>
          </div>
        </div>
        {!isBusiness && reputationVal && (
          <div className="inline-flex items-center gap-1.5" style={{ marginTop: 10, backgroundColor: "rgba(0, 201, 80, 0.10)", border: "1px solid rgba(0, 201, 80, 0.20)", color: "#257b5a", fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "3px 10px" }} title={`Reputation ${reputationVal}${s.reputationBadge ? ` · ${s.reputationBadge}` : ""}`}>
            <span aria-hidden="true">★</span>
            <span>{reputationVal}{s.reputationBadge ? ` · ${s.reputationBadge}` : ""}</span>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 10 }} aria-label="Workspace Navigation">
        {/* OVERVIEW SECTION (TOP) */}
        <div style={{ color: "#71717b", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", padding: "4px 8px 6px 8px" }}>OVERVIEW</div>
        <div className="space-y-1 mb-4">{renderRow(overviewItem)}</div>

        {/* WORK SECTION */}
        <div style={{ color: "#71717b", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", padding: "4px 8px 6px 8px" }}>WORK</div>
        <div className="space-y-1 mb-4">{workItems.map(renderRow)}</div>

        {/* ACCOUNT SECTION */}
        <div style={{ color: "#71717b", fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", padding: "4px 8px 6px 8px" }}>ACCOUNT</div>
        <div className="space-y-1">{accountItems.map(renderRow)}</div>
      </nav>

      {/* Wallet Widget & Footer */}
      <div style={{ padding: 12, borderTop: "1px solid #e4e4e7", backgroundColor: "#ffffff" }}>
        {/* Unified Wallet Card with Integrated Logout Button */}
        <div
          style={{
            position: "relative",
            backgroundColor: "#f9fafb",
            border: "1px solid #e4e4e7",
            borderRadius: 12,
            padding: "12px 14px",
            background: "linear-gradient(180deg, #ffffff 0%, #f4faf6 100%)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
          }}
        >
          {/* Card Header: Label & Integrated Logout Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span
              style={{
                color: "#71717b",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "#257b5a" }}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              {s.walletLabel?.toUpperCase() || "GIG WALLET"}
            </span>

            {/* Logout Button inside Wallet Card */}
            <form action={logoutAction} style={{ margin: 0, padding: 0 }}>
              <button
                type="submit"
                aria-label="Sign Out"
                title="Sign Out"
                className="transition-colors hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 6,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e4e4e7",
                  color: "#71717b",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Logout</span>
              </button>
            </form>
          </div>

          {/* Wallet Balance Link */}
          {walletVal && (
            <Link
              href={`${base}?tab=${isBusiness ? "billing" : "wallet"}`}
              style={{ textDecoration: "none", display: "block" }}
            >
              <div style={{ color: "#257b5a", fontSize: 20, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                {walletVal}
              </div>
              {s.walletSubtext && (
                <div style={{ color: "#71717b", fontSize: 11, fontWeight: 500, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 9999, backgroundColor: "#00c950", flexShrink: 0 }} />
                  <span>{s.walletSubtext}</span>
                </div>
              )}
            </Link>
          )}
        </div>

        {/* Primary Action Button */}
        <Link
          href={`${base}?tab=${isBusiness ? "issue-pool" : "issues"}`}
          className="mt-2.5 w-full flex items-center justify-center gap-2 transition-all hover:brightness-105 active:scale-[0.99]"
          style={{
            height: 42,
            backgroundColor: "#00c950",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "0.875rem",
            letterSpacing: "0.03em",
            borderRadius: 8,
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(0, 201, 80, 0.20)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>{isBusiness ? "POST TASK" : "CLAIM ISSUE"}</span>
        </Link>
      </div>
    </aside>
  );
}