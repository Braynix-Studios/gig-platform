"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DevTask, DevTransaction, DevPR } from "@/components/dashboard/DeveloperDashboard";
import type { SavedTask } from "@/lib/saved-tasks";

const CHARCOAL = "#151b1d";
const BORDER = "#e4e4e7";
const MUTED = "#71717b";
const GREEN = "#257b5a";
const MINT = "#00c950";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";
const CARD_SHADOW = "0 4px 20px rgba(0, 0, 0, 0.04)";

export interface ActivityItem {
  id: string;
  category: "tasks" | "prs" | "wallet" | "system";
  title: string;
  subtitle: string;
  timestamp: string;
  status: string;
  statusColor?: string;
  href: string;
  actionText: string;
}

interface ActivityFeedProps {
  role: "developer" | "business";
  savedTasks?: SavedTask[];
  claimedTasks?: DevTask[];
  verifiedPRs?: DevPR[];
  transactions?: DevTransaction[];
  githubHandle?: string | null;
  displayName?: string;
}

export default function ActivityFeed({
  role,
  savedTasks = [],
  claimedTasks = [],
  verifiedPRs = [],
  transactions = [],
  githubHandle,
  displayName = "User",
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<"all" | "tasks" | "prs" | "wallet" | "system">("all");

  const activities = useMemo(() => {
    const list: ActivityItem[] = [];

    // 1. Saved Tasks
    savedTasks.forEach((st) => {
      list.push({
        id: `saved-${st.id}`,
        category: "tasks",
        title: `Saved to Task Backlog: ${st.title}`,
        subtitle: st.repo ? `Repository: ${st.repo} · Reward: ${st.reward || "—"}` : "Saved for later claim",
        timestamp: st.savedAt ? new Date(st.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recent",
        status: "SAVED",
        statusColor: "#0284c7",
        href: role === "business" ? "/dashboard/business?tab=tasks-backlog" : "/dashboard/developer?tab=tasks",
        actionText: "View Backlog",
      });
    });

    // 2. Claimed Tasks
    claimedTasks.forEach((ct) => {
      list.push({
        id: `claim-${ct.id}`,
        category: "tasks",
        title: `Claimed Active Issue: ${ct.title}`,
        subtitle: `Repo: ${ct.repo} · Escrow Locked: ${ct.lockedAmount}`,
        timestamp: "Active",
        status: ct.status.toUpperCase(),
        statusColor: MINT,
        href: role === "business" ? "/dashboard/business?tab=tasks-backlog" : "/dashboard/developer?tab=tasks",
        actionText: "View Task",
      });
    });

    // 3. Verified PRs
    verifiedPRs.forEach((pr) => {
      list.push({
        id: `pr-${pr.id}`,
        category: "prs",
        title: `Verified PR: ${pr.title}`,
        subtitle: `Repo: ${pr.repo} · Merged: ${pr.mergedAt || "Recently"}`,
        timestamp: pr.mergedAt || "Recent",
        status: "VERIFIED",
        statusColor: "#7c3aed",
        href: role === "business" ? "/dashboard/business?tab=issue-pool" : "/dashboard/developer?tab=prs",
        actionText: "View PR",
      });
    });

    // 4. Transactions
    transactions.forEach((tx) => {
      list.push({
        id: `tx-${tx.id}`,
        category: "wallet",
        title: `${tx.type === "credit" ? "Credit Received" : "Withdrawal Disbursal"}: ${tx.amount}`,
        subtitle: `${tx.description} · Date: ${tx.date}`,
        timestamp: tx.date || "Recent",
        status: tx.status.toUpperCase(),
        statusColor: tx.status === "Completed" ? GREEN : "#d97706",
        href: role === "business" ? "/dashboard/business?tab=billing" : "/dashboard/developer?tab=wallet",
        actionText: "View Wallet",
      });
    });

    // 5. System events
    if (githubHandle) {
      list.push({
        id: "sys-github",
        category: "system",
        title: "GitHub Account Connected & Verified",
        subtitle: `Synced as @${githubHandle} with GIG contribution graph`,
        timestamp: "Synced",
        status: "CONNECTED",
        statusColor: GREEN,
        href: role === "business" ? "/dashboard/business?tab=profile" : "/dashboard/developer?tab=profile",
        actionText: "Profile Settings",
      });
    }

    list.push({
      id: "sys-tier",
      category: "system",
      title: `${role === "business" ? "Tier 1 Business" : "Tier 2 Contributor"} Active`,
      subtitle: "Verified contribution record and escrow initialized",
      timestamp: "Active",
      status: "LIVE",
      statusColor: MINT,
      href: role === "business" ? "/dashboard/business?tab=profile" : "/dashboard/developer?tab=profile",
      actionText: "View Status",
    });

    return list;
  }, [savedTasks, claimedTasks, verifiedPRs, transactions, githubHandle, role]);

  const filteredActivities = useMemo(() => {
    if (filter === "all") return activities;
    return activities.filter((a) => a.category === filter);
  }, [activities, filter]);

  const counts = useMemo(() => {
    return {
      all: activities.length,
      tasks: activities.filter((a) => a.category === "tasks").length,
      prs: activities.filter((a) => a.category === "prs").length,
      wallet: activities.filter((a) => a.category === "wallet").length,
      system: activities.filter((a) => a.category === "system").length,
    };
  }, [activities]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "tasks":
        return (
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: MINT_SOFT, border: `1px solid ${MINT_BDR}`, color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
          </div>
        );
      case "prs":
        return (
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(124, 58, 237, 0.10)", border: "1px solid rgba(124, 58, 237, 0.20)", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" /></svg>
          </div>
        );
      case "wallet":
        return (
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(16, 185, 129, 0.10)", border: "1px solid rgba(16, 185, 129, 0.20)", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
          </div>
        );
      default:
        return (
          <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(2, 132, 199, 0.10)", border: "1px solid rgba(2, 132, 199, 0.20)", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner / Summary Cards */}
      <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 28px", boxShadow: CARD_SHADOW }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 9999, backgroundColor: MINT_SOFT, border: `1px solid ${MINT_BDR}`, color: GREEN, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: MINT }} />
              LIVE ACTIVITY DASHBOARD
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: CHARCOAL, margin: 0, letterSpacing: "-0.03em" }}>
              Welcome back, {displayName}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: MUTED }}>
              Overview of all your real-time activities, task claims, PR contributions, and wallet disbursals.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href={role === "business" ? "/dashboard/business?tab=issue-pool" : "/dashboard/developer?tab=issues"}
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 6,
                backgroundColor: MINT,
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              Explore Issue Pool
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "#f9fafb", border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>Total Events</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: CHARCOAL, marginTop: 2 }}>{counts.all}</div>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "#f9fafb", border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>Saved & Active Tasks</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: GREEN, marginTop: 2 }}>{counts.tasks}</div>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "#f9fafb", border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>Verified PRs</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#7c3aed", marginTop: 2 }}>{counts.prs}</div>
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "#f9fafb", border: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>Wallet Transactions</span>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669", marginTop: 2 }}>{counts.wallet}</div>
          </div>
        </div>
      </div>

      {/* Activity Timeline Card */}
      <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 28px", boxShadow: CARD_SHADOW }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL, margin: 0 }}>
            Activity Feed
          </h3>

          {/* Filter Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {(["all", "tasks", "prs", "wallet", "system"] as const).map((cat) => {
              const active = filter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 9999,
                    border: `1px solid ${active ? MINT : BORDER}`,
                    backgroundColor: active ? MINT_SOFT : "transparent",
                    color: active ? GREEN : MUTED,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat === "all" ? `All (${counts.all})` : cat === "prs" ? `PRs (${counts.prs})` : `${cat} (${counts[cat]})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity Stream List */}
        {filteredActivities.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: MUTED, fontSize: "0.875rem" }}>
            No activity records found for this filter category.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredActivities.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 10,
                  backgroundColor: "#ffffff",
                  border: `1px solid ${BORDER}`,
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  {getCategoryIcon(item.category)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: CHARCOAL }}>
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 8px",
                          borderRadius: 9999,
                          backgroundColor: `${item.statusColor || GREEN}15`,
                          color: item.statusColor || GREEN,
                          border: `1px solid ${item.statusColor || GREEN}30`,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: "0.8125rem", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>{item.timestamp}</span>
                  <Link
                    href={item.href}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      backgroundColor: "#f4f4f5",
                      border: `1px solid ${BORDER}`,
                      color: CHARCOAL,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.actionText}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
