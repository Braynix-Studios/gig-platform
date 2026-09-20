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
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
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
    <path d="M23 21v-2a4 4 0 0 1 0 7.75" />
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
    : (s.reputationScore !== undefined ? String(s.reputationScore) : undefined) ?? s.reputationValue ?? "98.4";
  const walletVal = s.walletBalance ?? s.walletValue ?? "₹0";

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

  const workspaceItems = isBusiness
    ? [
        { label: "Dashboard", tab: "dashboard", icon: dashboardIcon, badge: "LIVE" },
        { label: "Tasks Backlog", tab: "tasks-backlog", icon: tasksIcon, count: (s.tasksCount !== undefined ? String(s.tasksCount) : undefined) ?? s.counts?.["Tasks Backlog"] ?? "0" },
        { label: "Issue Pool", tab: "issue-pool", icon: layersIcon, count: s.counts?.["Issue Pool"] ?? "11" },
        { label: "Talent Pool", tab: "talent-pool", icon: talentIcon, count: s.counts?.["Talent Pool"] ?? "42" },
        { label: "Workspace", tab: "workspace", icon: overviewIcon },
      ]
    : [
        { label: "Dashboard", tab: "dashboard", icon: dashboardIcon, badge: "LIVE" },
        { label: "Tasks", tab: "tasks", icon: tasksIcon, count: (s.tasksCount !== undefined ? String(s.tasksCount) : undefined) ?? s.counts?.["Tasks"] ?? "0" },
        { label: "Issue Pool", tab: "issues", icon: layersIcon, count: s.counts?.["Issue Pool"] ?? "11" },
        { label: "Verified PRs", tab: "prs", icon: prsIcon, count: (s.prsCount !== undefined ? String(s.prsCount) : undefined) ?? s.counts?.["Verified PRs"] ?? "0" },
      ];

  const accountItems = isBusiness
    ? [
        { label: "Profile", tab: "profile", icon: profileIcon },
        { label: "Billing/Escrow", tab: "billing", icon: walletIcon },
      ]
    : [
        { label: "Profile", tab: "profile", icon: profileIcon },
        { label: "Wallet", tab: "wallet", icon: walletIcon },
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
          borderRadius: 8,
          padding: "10px 12px",
          backgroundColor: active ? "rgba(0, 201, 80, 0.10)" : "transparent",
          color: active ? "#00c950" : "#09090b",
          fontWeight: active ? 700 : 600,
          fontSize: "1.0625rem",
          borderLeft: active ? "3px solid #00c950" : "3px solid transparent",
          textDecoration: "none",
        }}
      >
        <span className="flex items-center gap-3">
          <span style={{ color: active ? "#00c950" : "#71717b" }}>{item.icon}</span>
          <span>{item.label}</span>
        </span>
        {item.badge ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 9999,
              backgroundColor: "rgba(0, 201, 80, 0.10)",
              color: "#00c950",
              border: "1px solid rgba(0, 201, 80, 0.20)",
              letterSpacing: "0.1em",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ● {item.badge}
          </span>
        ) : item.count !== undefined ? (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 8,
              backgroundColor: active ? "#ffffff" : "transparent",
              border: "1px solid #e4e4e7",
              color: "#09090b",
            }}
          >
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
      style={{
        width: 314,
        backgroundColor: "rgba(244, 244, 245, 0.40)",
        borderRight: "1px solid #e4e4e7",
      }}
    >
      {/* 1. Header Block */}
      <div style={{ padding: "28px 20px 24px", borderBottom: "1px solid #e4e4e7" }}>
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="GIG Home"
            style={{
              color: "#00c950",
              fontSize: "2.375rem",
              fontWeight: 900,
              letterSpacing: "-0.08em",
              lineHeight: 1,
              textDecoration: "none",
            }}
          >
            gig
          </Link>
          <span
            className="pill-badge inline-flex items-center gap-1.5"
            style={{
              color: "#00c950",
              backgroundColor: "rgba(0, 201, 80, 0.10)",
              border: "1px solid rgba(0, 201, 80, 0.20)",
              padding: "4px 12px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            ● {isBusiness ? "BUSINESS" : "DEVELOPER"}
          </span>
        </div>
        <div
          style={{
            marginTop: 20,
            color: "#71717b",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {isBusiness ? "SPONSOR WORKSPACE" : "CONTRIBUTION WORKSPACE"}
        </div>
        <div style={{ marginTop: 8, fontSize: "1.125rem", color: "#09090b", fontWeight: 500 }}>
          {isBusiness ? "Fund, review, and ship" : "Find, build, and earn"}
        </div>
      </div>

      {/* 2. Contributor / User Profile Block */}
      <div id="profile" style={{ padding: "20px", borderBottom: "1px solid #e4e4e7" }}>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 60,
              height: 60,
              backgroundColor: "rgba(0, 201, 80, 0.10)",
              border: "1px solid rgba(0, 201, 80, 0.20)",
              borderRadius: "0.5rem",
              color: "#00c950",
              fontSize: 14,
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate" style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#09090b", lineHeight: 1.2 }}>
              {displayName}
            </p>
            <p className="truncate" style={{ fontSize: 13, color: "#71717b", marginTop: 4, lineHeight: 1.2 }}>
              {displayEmail}
            </p>
          </div>
        </div>
        {!isBusiness && (
          <div
            className="inline-flex items-center gap-1.5"
            style={{
              marginTop: 16,
              backgroundColor: "rgba(0, 201, 80, 0.10)",
              border: "1px solid rgba(0, 201, 80, 0.20)",
              color: "#00c950",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 9999,
              padding: "4px 12px",
            }}
          >
            <span>★ {reputationVal || "98.4"}{s.reputationBadge ? ` · ${s.reputationBadge}` : " · TOP 2%"}</span>
          </div>
        )}
      </div>

      {/* 3. Navigation Sections (WORKSPACE & ACCOUNT) */}
      <nav className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "20px 12px" }} aria-label="Workspace Navigation">
        {/* WORKSPACE SECTION */}
        <div style={{ color: "#71717b", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "0 8px 8px 8px" }}>
          WORKSPACE
        </div>
        <div className="space-y-1 mb-6">{workspaceItems.map(renderRow)}</div>

        {/* ACCOUNT SECTION */}
        <div style={{ color: "#71717b", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "8px 8px 8px 8px" }}>
          ACCOUNT
        </div>
        <div className="space-y-1">{accountItems.map(renderRow)}</div>
      </nav>

      {/* 4. Wallet Summary Card & Actions pinned at bottom */}
      <div style={{ padding: "15px" }}>
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: "0.5rem",
            padding: "16px",
          }}
        >
          {/* Card Header: GIG WALLET & Logout button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                color: "#71717b",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "#00c950" }}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span>{s.walletLabel?.toUpperCase() || "GIG WALLET"}</span>
            </div>

            {/* Logout button */}
            <form action={logoutAction} style={{ margin: 0, padding: 0 }}>
              <button
                type="submit"
                aria-label="Sign Out"
                title="Sign Out"
                className="inline-flex items-center gap-1 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: "0.5rem",
                  border: "1px solid #e4e4e7",
                  backgroundColor: "#ffffff",
                  color: "#09090b",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Logout</span>
              </button>
            </form>
          </div>

          {/* Balance */}
          <Link
            href={`${base}?tab=${isBusiness ? "billing" : "wallet"}`}
            style={{ textDecoration: "none", display: "block", marginTop: 16 }}
          >
            <div style={{ color: "#00c950", fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>
              {walletVal || "₹0"}
            </div>
            <div style={{ color: "#71717b", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#00c950" }}>●</span>
              <span>{s.walletSubtext || "Above ₹500 UPI threshold"}</span>
            </div>
          </Link>
        </div>

        {/* Full-width green CLAIM ISSUE button */}
        <Link
          href={`${base}?tab=${isBusiness ? "issue-pool" : "issues"}`}
          className="mt-4 w-full flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{
            height: 53,
            backgroundColor: "#00c950",
            color: "#f0fdf4",
            fontWeight: 700,
            fontSize: 17,
            borderRadius: "0.5rem",
            textDecoration: "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>{isBusiness ? "POST TASK" : "CLAIM ISSUE"}</span>
        </Link>
      </div>
    </aside>
  );
}