"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, FormEvent } from "react";
import DevHeader from "@/components/dashboard/DevHeader";
import MetricCard from "@/components/dashboard/MetricCard";
import TaskTable from "@/components/dashboard/TaskTable";
import ProofOfWorkCard from "@/components/dashboard/ProofOfWorkCard";
import IssuePool from "@/components/dashboard/IssuePool";
import type { IssuePoolData } from "@/lib/dashboard-data";
import { cleanGithubHandle } from "@/lib/db-operations";

const BG_PAGE = "#fbfcfb";
const CHARCOAL = "#151b1d";
const BORDER = "#e4e4e7";
const MUTED = "#71717b";
const GREEN = "#257b5a";
const MINT = "#00c950";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";
const MINT_FG = "#f0fdf4";
const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

type DevTab = "tasks" | "issues" | "prs" | "wallet" | "profile";

export interface DevTask {
  id: string;
  title: string;
  repo: string;
  status: "Locked" | "In Progress" | "Submitted" | "Verified";
  assignee: string;
  lockedAmount: string;
  lockExpiry: string;
}

export interface DevTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: "credit" | "debit";
  status: "Completed" | "Pending";
}

export interface DevBadge {
  label: string;
  description: string;
  earned: string;
}

export interface DevPR {
  id: string;
  repo: string;
  title: string;
  mergedAt: string;
  linesChanged: string;
}

export interface DevStats {
  reputationScore: string;
  reputationBadge: string;
  reputationFooter: string;
  verifiedContributions: string;
  contributionsFooter: string;
  lockedTasks: string;
  lockedFooter: string;
  walletBalance: string;
  walletFooter: string;
}

export interface DeveloperDashboardData {
  displayName: string;
  handle: string;
  githubHandle?: string | null;
  stats: DevStats;
  tasks: DevTask[];
  transactions: DevTransaction[];
  badges: DevBadge[];
  verifiedPRs: DevPR[];
  walletTxCount: number;
  // Profile fields for editing
  username: string;
  avatar_url: string | null;
  github_handle: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers_count: number | null;
  public_repos_count: number | null;
}

export interface DeveloperProfileState {
  username: string;
  handle: string;
  avatar_url: string | null;
  github_handle: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  followers_count: number | null;
  public_repos_count: number | null;
}

export interface DevDashboardProps {
  data?: DeveloperDashboardData;
  issuePool?: IssuePoolData;
}

const FALLBACK: DeveloperDashboardData = {
  displayName: "ALEX RIVERS",
  handle: "alex.rivers@gig.dev",
  stats: {
    reputationScore: "98.4",
    reputationBadge: "TOP 2%",
    reputationFooter: "0–100 Weighted Score · Top 2% Network",
    verifiedContributions: "24",
    contributionsFooter: "Across 6 production open-source repositories",
    lockedTasks: "2",
    lockedFooter: "₹4,700 in locked escrow · 48h lock active",
    walletBalance: "₹4,850",
    walletFooter: "Ready for instant UPI bank withdrawal (Min ₹500)",
  },
  tasks: [
    { id: "task-1", title: "Fix stale redirect marker in hidden Activity", repo: "vercel/next.js", status: "Verified", assignee: "Alex Rivers", lockedAmount: "₹2,500", lockExpiry: "48h" },
    { id: "task-2", title: "Implement HMAC-SHA256 Session Middleware Gate", repo: "gig/auth-core", status: "In Progress", assignee: "Alex Rivers", lockedAmount: "₹2,200", lockExpiry: "48h" },
  ],
  transactions: [
    { id: "txn-1", date: "2026-09-14", description: "Bounty Disbursal - Next.js PR #98006", amount: "₹500", type: "credit", status: "Completed" },
    { id: "txn-2", date: "2026-09-10", description: "Bounty Disbursal - Auth Core PR #4521", amount: "₹1,200", type: "credit", status: "Completed" },
    { id: "txn-3", date: "2026-09-05", description: "UPI Withdrawal to Bank", amount: "₹2,000", type: "debit", status: "Completed" },
    { id: "txn-4", date: "2026-09-01", description: "Bounty Disbursal - Storage Mesh PR #1023", amount: "₹1,800", type: "credit", status: "Completed" },
  ],
  badges: [
    { label: "Next.js L2 Specialist", description: "Verified expertise in Next.js 15+ App Router", earned: "2026-08-15" },
    { label: "React 19 Early Adopter", description: "Production deployment with React 19 RC", earned: "2026-07-22" },
    { label: "TypeScript Champion", description: "100+ PRs with strict TypeScript compliance", earned: "2026-06-10" },
  ],
  verifiedPRs: [
    { id: "pr-1", repo: "vercel/next.js", title: "Fix stale redirect marker in hidden Activity", mergedAt: "2026-09-12", linesChanged: "+352 / -3" },
    { id: "pr-2", repo: "vercel/next.js", title: "Improve Turbopack cache invalidation", mergedAt: "2026-08-28", linesChanged: "+124 / -12" },
    { id: "pr-3", repo: "gig/auth-core", title: "Implement HMAC-SHA256 Session Middleware", mergedAt: "2026-08-10", linesChanged: "+89 / -4" },
  ],
  walletTxCount: 4,
  // Profile fields for editing
  username: "alex.rivers",
  avatar_url: null,
  github_handle: null,
  bio: null,
  company: null,
  location: null,
  followers_count: null,
  public_repos_count: null
};

const evidence = [
  {
    label: "Merge Latency",
    value: "4 Days from Lock to Maintainer Merge",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Inspected Code Diff",
    value: "+352 lines · -3 lines · 107 passing unit tests",
    green: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    label: "Maintainer Sign-Off",
    value: "Approved by @eps1lon (Core Team)",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
  },
];

const footer = [
  { label: "REPUTATION AWARD", value: "+4 pts", valueColor: MINT },
  { label: "VERIFIED SPECIALIZATION", value: "Next.js L2", valueColor: "#ffffff" },
  { label: "BOUNTY DISBURSED", value: "₹500", valueColor: MINT },
];

function createEmptyIssuePool(role: "developer" | "business"): IssuePoolData {
  return {
    role,
    displayName: "Developer",
    initials: "DV",
    company: null,
    issues: [],
    openCount: 0,
    claimedByMe: 0,
    claimedTotal: 0,
    rewardTotal: 0,
    rewardCurrency: "INR",
    matchScore: role === "business" ? "0%" : "82%",
    matchLabel: role === "business" ? "Engagement" : "Match score",
    matchSub: "how well your profile fits the pool",
    recommended: [],
    journey:
      role === "business"
        ? [
            { num: 1, title: "Post issue", desc: "Create a task spec with clear acceptance criteria" },
            { num: 2, title: "Fund escrow", desc: "Rewards stay locked in the vault until verified" },
            { num: 3, title: "Review PRs", desc: "Inspect pull requests and accept merged work" },
            { num: 4, title: "Pay out", desc: "Verified contributions disburse straight to devs" },
          ]
        : [
            { num: 1, title: "Browse", desc: "Pick an issue that matches your skill set" },
            { num: 2, title: "Claim", desc: "Lock the issue for up to 48 hours" },
            { num: 3, title: "Submit PR", desc: "Open a pull request against the repository" },
            { num: 4, title: "Get paid", desc: "Verified PRs credit directly to your wallet" },
          ],
  };
}

function TabContent({
  activeTab,
  data,
  issuePool,
  walletBalance,
  transactions,
  withdrawalAmount,
  setWithdrawalAmount,
  withdrawalLoading,
  withdrawalError,
  withdrawalSuccess,
  handleWithdrawalSubmit,
  profileState,
  isEditing,
  setIsEditing,
  formValues,
  setFormValues,
  savingProfile,
  profileSuccess,
  profileError,
  handleSaveProfile,
}: {
  activeTab: DevTab;
  data: DeveloperDashboardData;
  issuePool?: IssuePoolData;
  walletBalance: string;
  transactions: DevTransaction[];
  withdrawalAmount: string;
  setWithdrawalAmount: (amount: string) => void;
  withdrawalLoading: boolean;
  withdrawalError: string | null;
  withdrawalSuccess: boolean;
  handleWithdrawalSubmit: (event: FormEvent) => Promise<void>;
  profileState: DeveloperProfileState;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  formValues: DeveloperProfileState;
  setFormValues: React.Dispatch<React.SetStateAction<DeveloperProfileState>>;
  savingProfile: boolean;
  profileSuccess: string | null;
  profileError: string | null;
  handleSaveProfile: () => Promise<void>;
}) {
  const { stats, tasks, badges, verifiedPRs } = data;
  // Override stats.walletBalance with the fetched one
  const overriddenStats = { ...stats, walletBalance };
  const initials = data.displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  switch (activeTab) {
    case "issues":
      return <IssuePool data={issuePool ?? createEmptyIssuePool("developer")} role="developer" />;

    case "tasks":
      return (
        <>
          <section id="tasks" aria-label="Contributor stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginTop: 32, scrollMarginTop: 24 }} className="dev-metrics-grid">
            <MetricCard label="Reputation Score" value={overriddenStats.reputationScore} badge={overriddenStats.reputationBadge} green footer={overriddenStats.reputationFooter} />
            <MetricCard label="Verified Contributions" value={overriddenStats.verifiedContributions} footer={overriddenStats.contributionsFooter} />
            <MetricCard label="Locked Active Tasks" value={overriddenStats.lockedTasks} footer={overriddenStats.lockedFooter} />
            <MetricCard anchorId="wallet" label="GIG Wallet Balance" value={overriddenStats.walletBalance} green footer={overriddenStats.walletFooter} />
          </section>

          <section id="task-backlog" style={{ marginTop: 40, scrollMarginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: MUTED, margin: 0 }}>Active Tasks</p>
                <h2 style={{ marginTop: 4, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.33, color: CHARCOAL, margin: "4px 0 0" }}>TASK BACKLOG</h2>
              </div>
            </div>
            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <TaskTable tasks={tasks} isBusiness={false} />
            </div>
          </section>
        </>
      );

    case "prs":
      return (
        <section id="prs" style={{ marginTop: 40, scrollMarginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: MUTED, margin: 0 }}>Inspectable Proof-of-Work</p>
              <h2 style={{ marginTop: 4, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.33, color: CHARCOAL, margin: "4px 0 0" }}>LATEST VERIFIED CONTRIBUTION</h2>
            </div>
            {verifiedPRs.length > 0 && (
              <a href="https://github.com/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: "none", paddingBottom: 4, whiteSpace: "nowrap" }}>Verify on GitHub →</a>
            )}
          </div>
          {verifiedPRs.length > 0 ? (
            <ProofOfWorkCard repo={verifiedPRs[0].repo} prNumber={verifiedPRs[0].id} prUrl={`https://github.com/${verifiedPRs[0].repo}`} title={verifiedPRs[0].title} subtitle="Tier 2 Task · TypeScript / Next.js / React 19 Server Components" evidence={evidence} footer={footer} />
          ) : (
            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, padding: 32, textAlign: "center", color: MUTED, fontSize: 14 }}>
              No verified contributions yet. Claim an issue to get started.
            </div>
          )}
        </section>
      );

    case "wallet":
      return (
        <section id="wallet" style={{ marginTop: 40, scrollMarginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${BORDER}` }}>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL }}>Transaction History</h3>
              </div>
              <div>
                {transactions.length === 0 ? (
                  <p style={{ padding: "24px", color: MUTED, fontSize: 13, margin: 0 }}>No wallet transactions yet.</p>
                ) : (
                  transactions.map((txn, idx) => (
                    <div key={txn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 24px", borderTop: idx === 0 ? "none" : `1px solid ${BORDER}` }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: CHARCOAL }}>{txn.description}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{txn.date}</p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: txn.type === "credit" ? GREEN : CHARCOAL, fontSize: 14 }}>{txn.type === "credit" ? "+" : "−"}{txn.amount}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>{txn.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>GIG Wallet</p>
                <p style={{ margin: "8px 0 0", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.04em", color: GREEN }}>{walletBalance}</p>
              </div>
              <div style={{ paddingTop: 16, borderTop: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: MUTED }}>Available for Withdrawal</span><span style={{ fontWeight: 600, color: CHARCOAL }}>{walletBalance}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: MUTED }}>Minimum Withdrawal</span><span style={{ fontWeight: 500, color: CHARCOAL }}>₹500</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: MUTED }}>Processing Time</span><span style={{ fontWeight: 500, color: CHARCOAL }}>Instant (UPI)</span></div>
              </div>
{/* Withdrawal Form */}
              <div style={{ marginTop: 16 }}>
                <form id="withdrawal-form" onSubmit={handleWithdrawalSubmit}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <input
                      type="number"
                      min="500"
                      placeholder="Amount (₹)"
                      value={withdrawalAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setWithdrawalAmount(val === "" ? "" : val);
                      }}
                      style={{
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 4,
                        fontSize: 13,
                        width: 120,
                      }}
                      disabled={withdrawalLoading}
                    />
                    <button
                      type="submit"
                      style={{
                        backgroundColor: MINT,
                        color: MINT_FG,
                        border: "none",
                        borderRadius: 4,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: withdrawalLoading ? "not-allowed" : "pointer",
                        opacity: withdrawalLoading ? 0.7 : 1,
                      }}
                      disabled={withdrawalLoading}
                    >
                      {withdrawalLoading ? "Processing..." : "Withdraw"}
                    </button>
                  </div>
                  {withdrawalError && (
                    <p style={{ color: "#ff4d4d", fontSize: 12, margin: 0 }}>{withdrawalError}</p>
                  )}
                  {withdrawalSuccess && (
                    <p style={{ color: GREEN, fontSize: 12, margin: 0 }}>Withdrawal successful! Balance updated.</p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </section>
      );

    case "profile":
      return (
        <section id="profile" style={{ marginTop: 40, scrollMarginTop: 24, display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>
          <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Profile Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {profileState.avatar_url ? (
                <img
                  src={profileState.avatar_url}
                  alt={profileState.username}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    objectFit: "cover",
                    border: "1px solid #c8b8f1",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: "#eee8ff", border: "1px solid #c8b8f1", color: "#6048a8", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
                  {initials}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: CHARCOAL }}>
                  {isEditing ? formValues.username || profileState.username : profileState.username}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED, fontFamily: "monospace" }}>
                  {isEditing ? formValues.handle || profileState.handle : profileState.handle}
                </p>
              </div>
            </div>

            {/* Reputation Badge */}
            <div style={{ backgroundColor: MINT_SOFT, border: `1px solid ${MINT_BDR}`, color: GREEN, fontSize: 13, fontWeight: 700, borderRadius: 9999, padding: "8px 16px", textAlign: "center" }}>
              ★ {overriddenStats.reputationScore} · {overriddenStats.reputationBadge}
            </div>

            {/* Status alerts */}
            {profileSuccess && (
              <div style={{ padding: "10px 14px", backgroundColor: "rgba(0, 201, 80, 0.12)", border: "1px solid rgba(0, 201, 80, 0.25)", color: GREEN, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                ✓ {profileSuccess}
              </div>
            )}
            {profileError && (
              <div style={{ padding: "10px 14px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, fontSize: 13 }}>
                {profileError}
              </div>
            )}

            {/* Edit Button / Save & Cancel Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setFormValues({ ...profileState });
                    setIsEditing(true);
                  }}
                  style={{
                    height: 36,
                    padding: "0 16px",
                    backgroundColor: MINT,
                    color: MINT_FG,
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={savingProfile}
                    style={{
                      height: 36,
                      padding: "0 16px",
                      backgroundColor: "#ffffff",
                      color: CHARCOAL,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    style={{
                      height: 36,
                      padding: "0 16px",
                      backgroundColor: MINT,
                      color: MINT_FG,
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: savingProfile ? "not-allowed" : "pointer",
                      opacity: savingProfile ? 0.7 : 1,
                    }}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </>
              )}
            </div>

            {/* Profile Info Section */}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              {!isEditing ? (
                <>
                  {/* Bio */}
                  <div>
                    <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Bio / Introduction</span>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: CHARCOAL, lineHeight: 1.5 }}>
                      {profileState.bio || "No bio added yet. Click 'Edit Profile' to introduce yourself."}
                    </p>
                  </div>

                  {/* Metadata key-value rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #f4f4f5", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Company</span><span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.company || "Independent Contributor"}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Location</span><span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.location || "Remote"}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Public Repos</span><span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.public_repos_count ?? "—"}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Followers</span><span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.followers_count ?? "—"}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Joined GIG</span><span style={{ fontWeight: 600, color: CHARCOAL }}>March 2024</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Total Earnings</span><span style={{ fontWeight: 700, color: GREEN }}>{overriddenStats.walletBalance}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: MUTED }}>Wallet Address</span><span style={{ fontWeight: 500, color: CHARCOAL, fontSize: 11, fontFamily: "monospace" }}>0x7a2e...4d1f</span></div>
                  </div>

                  {/* GitHub Connect Section */}
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                    <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>GitHub Profile</span>
                    <div style={{ marginTop: 8 }}>
                      {cleanGithubHandle(profileState.github_handle) ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                          <a
                            href={`https://github.com/${cleanGithubHandle(profileState.github_handle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 14px",
                              backgroundColor: MINT_SOFT,
                              color: GREEN,
                              fontWeight: 600,
                              fontSize: 13,
                              border: `1px solid ${MINT_BDR}`,
                              borderRadius: 6,
                              textDecoration: "none",
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2 4-4" /><path d="M12 22a10 9 0 1 0 0-18 10 9 0 0 0 0 18z" /></svg>
                            <span>@{cleanGithubHandle(profileState.github_handle)}</span>
                          </a>
                          <span style={{ fontSize: 11, color: MUTED }}>Verified Contributor</span>
                        </div>
                      ) : (
                        <div
                          style={{
                            backgroundColor: "#f9fafb",
                            border: `1px dashed ${BORDER}`,
                            borderRadius: 8,
                            padding: 16,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: "#f59e0b" }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: CHARCOAL }}>GitHub Not Connected</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
                            Connect your GitHub account to sync your profile avatar, verify your merged pull requests, and display verified proofs of work across bounties.
                          </p>
                          <div>
                            <a
                              href="/api/auth/github"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 16px",
                                backgroundColor: CHARCOAL,
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: 13,
                                borderRadius: 6,
                                textDecoration: "none",
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                              Connect GitHub Account
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Editable Form Fields */
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>Display Name</label>
                    <input
                      type="text"
                      value={formValues.username || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, username: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        fontSize: 13,
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>Bio</label>
                    <textarea
                      value={formValues.bio || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, bio: e.target.value }))}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        fontSize: 13,
                        backgroundColor: "#ffffff",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>Company</label>
                    <input
                      type="text"
                      value={formValues.company || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, company: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        fontSize: 13,
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>Location</label>
                    <input
                      type="text"
                      value={formValues.location || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g. Remote / Bangalore, IN"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        fontSize: 13,
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>Avatar URL</label>
                    <input
                      type="text"
                      value={formValues.avatar_url || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, avatar_url: e.target.value }))}
                      placeholder="https://..."
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        fontSize: 13,
                        backgroundColor: "#ffffff",
                      }}
                    />
                    {formValues.avatar_url && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: MUTED }}>Preview:</span>
                        <img
                          src={formValues.avatar_url}
                          alt="Avatar preview"
                          style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: `1px solid ${BORDER}` }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>GitHub Handle</label>
                    <input
                      type="text"
                      value={formValues.github_handle || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, github_handle: e.target.value }))}
                      placeholder="e.g. octocat"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 6,
                        fontSize: 13,
                        backgroundColor: "#ffffff",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: CHARCOAL, fontWeight: 600 }}>Followers</label>
                      <input
                        type="number"
                        value={formValues.followers_count !== null && formValues.followers_count !== undefined ? String(formValues.followers_count) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormValues(prev => ({ ...prev, followers_count: val === "" ? null : parseInt(val, 10) }));
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 6,
                          fontSize: 13,
                          backgroundColor: "#ffffff",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: CHARCOAL, fontWeight: 600 }}>Public Repos</label>
                      <input
                        type="number"
                        value={formValues.public_repos_count !== null && formValues.public_repos_count !== undefined ? String(formValues.public_repos_count) : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormValues(prev => ({ ...prev, public_repos_count: val === "" ? null : parseInt(val, 10) }));
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 6,
                          fontSize: 13,
                          backgroundColor: "#ffffff",
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Verified Specializations and Contributions (always visible) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL }}>Verified Specializations</h3>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {badges.length === 0 ? (
                  <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>No specializations verified yet.</p>
                ) : (
                  badges.map((badge) => (
                    <div key={badge.label} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                      <div><p style={{ margin: 0, fontWeight: 600, color: CHARCOAL }}>{badge.label}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{badge.description}</p></div>
                      <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>Earned {badge.earned}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL }}>Verified Contributions</h3>
                <span style={{ fontSize: 11, color: MUTED }}>{stats.verifiedContributions} total</span>
              </div>
              <div>
                {verifiedPRs.length === 0 ? (
                  <p style={{ padding: "16px 20px", margin: 0, color: MUTED, fontSize: 13 }}>No verified contributions yet.</p>
                ) : (
                  verifiedPRs.map((pr, idx) => (
                    <div key={pr.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 20px", borderTop: idx === 0 ? "none" : `1px solid ${BORDER}` }}>
                      <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: 600, color: CHARCOAL }}>{pr.title}</p><p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{pr.repo} · {pr.mergedAt}</p></div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: GREEN, whiteSpace: "nowrap" }}>{pr.linesChanged}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      );
  }
}

export default function DeveloperDashboard({ data = FALLBACK, issuePool }: DevDashboardProps) {
  const searchParams = useSearchParams();
  const activeTab: DevTab = (() => {
    const tab = searchParams?.get("tab") as DevTab;
    return tab && ["tasks", "issues", "prs", "wallet", "profile"].includes(tab) ? tab : "tasks";
  })();

  const [walletData, setWalletData] = useState<{ balance: string; transactions: DevTransaction[] } | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(true);

  // Withdrawal form state
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>("");
  const [withdrawalLoading, setWithdrawalLoading] = useState<boolean>(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState<boolean>(false);

  // Profile state & edit form state
  const initialGithubHandle = cleanGithubHandle(data?.github_handle || data?.githubHandle);
  const [profileState, setProfileState] = useState<DeveloperProfileState>({
    username: data?.username || data?.displayName || FALLBACK.username,
    handle: data?.handle || FALLBACK.handle,
    avatar_url: data?.avatar_url || FALLBACK.avatar_url,
    github_handle: initialGithubHandle,
    bio: data?.bio || FALLBACK.bio,
    company: data?.company || FALLBACK.company,
    location: data?.location || FALLBACK.location,
    followers_count: data?.followers_count ?? FALLBACK.followers_count,
    public_repos_count: data?.public_repos_count ?? FALLBACK.public_repos_count,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<DeveloperProfileState>({ ...profileState });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const sanitizedValues = {
        ...formValues,
        github_handle: cleanGithubHandle(formValues.github_handle),
      };
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sanitizedValues),
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to update profile: ${res.status}`);
      }

      setProfileState({ ...formValues });
      setIsEditing(false);
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: unknown) {
      setProfileError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  // Fetch wallet data on mount
  useEffect(() => {
    async function fetchWallet() {
      setWalletLoading(true);
      try {
        const response = await fetch(`/api/wallet`, {
          method: "GET",
          credentials: "include", // Important to send cookies
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch wallet: ${response.status}`);
        }
        const json = await response.json();
        setWalletData(json);
      } catch {
        setWalletData(null); // Keep null so we can show error or fallback
      } finally {
        setWalletLoading(false);
      }
    }

    fetchWallet();
  }, []); // Empty deps means run once on mount

  // Refetch wallet data (used after successful withdrawal).
  // Silent mode refreshes in the background without flashing stale
  // prop data (walletLoading swaps the display source — see below).
  const refetchWallet = async (silent = false) => {
    if (!silent) setWalletLoading(true);
    try {
      const response = await fetch(`/api/wallet`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch wallet: ${response.status}`);
      }
      const json = await response.json();
      setWalletData(json);
    } catch {
      if (!silent) setWalletData(null);
    } finally {
      if (!silent) setWalletLoading(false);
    }
  };

  function formatINR(amount: number): string {
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
    return `₹${formatted}`;
  }

  // Handle withdrawal form submission
  const handleWithdrawalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setWithdrawalError(null);
    setWithdrawalSuccess(false);
    setWithdrawalLoading(true);

    const amount = parseFloat(withdrawalAmount);
    if (isNaN(amount) || amount < 500) {
      setWithdrawalError("Amount must be at least 500");
      setWithdrawalLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/wallet/withdrawal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Withdrawal failed");
      }

      // Success: patch the displayed balance instantly from the server's
      // authoritative new balance, then quietly refresh transactions behind it.
      const result = await response.json();
      if (typeof result.newBalance === "number") {
        const patched = formatINR(result.newBalance);
        setWalletData((prev) => (prev ? { ...prev, balance: patched } : prev));
      }
      setWithdrawalSuccess(true);
      setWithdrawalAmount("");
      void refetchWallet(true);
    } catch (err: unknown) {
      setWithdrawalError(getErrorMessage(err));
    } finally {
      setWithdrawalLoading(false);
    }
  };

  // Determine wallet balance and transactions to use
  // If we have fetched data, use it; otherwise, fall back to data prop or FALLBACK
  let balanceToDisplay = "₹0";
  let transactionsToDisplay: DevTransaction[] = [];
  if (!walletLoading && walletData) {
    // We have fetched data
    balanceToDisplay = walletData.balance;
    transactionsToDisplay = walletData.transactions;
  } else if (walletLoading && data) {
    // Still loading, use data from prop for now
    balanceToDisplay = data.stats.walletBalance;
    transactionsToDisplay = data.transactions;
  } else if (data) {
    // Error or no fetched data, fallback to data prop
    balanceToDisplay = data.stats.walletBalance;
    transactionsToDisplay = data.transactions;
  } else {
    // No data prop, use FALLBACK
    balanceToDisplay = FALLBACK.stats.walletBalance;
    transactionsToDisplay = FALLBACK.transactions;
  }

  // Create merged data object with overridden wallet balance and transactions
  const mergedData: DeveloperDashboardData = {
    ...(data ?? FALLBACK),
    stats: { ...(data ?? FALLBACK).stats, walletBalance: balanceToDisplay },
    transactions: transactionsToDisplay,
    walletTxCount: transactionsToDisplay.length,
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, color: CHARCOAL }}>
      <style>{`
        @media (max-width: 1024px) {
          .dev-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 640px) {
          .dev-page-wrap { padding: 24px 16px 64px !important; }
          .dev-metrics-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .contrib-footer { grid-template-columns: minmax(0, 1fr) !important; }
          .contrib-footer > div { border-right: none !important; border-top: 1px solid rgba(255,255,255,0.10); }
          .contrib-footer > div:first-child { border-top: none; }
          #profile { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
      <div className="dev-page-wrap" style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 36px 80px" }}>
        {activeTab === "issues" ? null : (
          <DevHeader
            displayName={profileState.username || mergedData.displayName}
            handle={profileState.handle || mergedData.handle}
            activeTab={activeTab}
            githubHandle={profileState.github_handle || mergedData.githubHandle}
          />
        )}
        <TabContent
          activeTab={activeTab}
          data={mergedData}
          issuePool={issuePool}
          walletBalance={balanceToDisplay}
          transactions={transactionsToDisplay}
          withdrawalAmount={withdrawalAmount}
          setWithdrawalAmount={setWithdrawalAmount}
          withdrawalLoading={withdrawalLoading}
          withdrawalError={withdrawalError}
          withdrawalSuccess={withdrawalSuccess}
          handleWithdrawalSubmit={handleWithdrawalSubmit}
          profileState={profileState}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          formValues={formValues}
          setFormValues={setFormValues}
          savingProfile={savingProfile}
          profileSuccess={profileSuccess}
          profileError={profileError}
          handleSaveProfile={handleSaveProfile}
        />
      </div>
    </div>
  );
}