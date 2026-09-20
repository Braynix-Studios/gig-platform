"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import BizHeader from "@/components/dashboard/BizHeader";
import SectionHeading from "@/components/dashboard/SectionHeading";
import TaskTable from "@/components/dashboard/TaskTable";
import TalentCard from "@/components/dashboard/TalentCard";
import EscrowCard from "@/components/dashboard/EscrowCard";
import Card from "@/components/dashboard/Card";
import IssuePool from "@/components/dashboard/IssuePool";
import SubmissionsReviewPanel from "@/components/dashboard/SubmissionsReviewPanel";
import GitHubImportModal from "@/components/dashboard/GitHubImportModal";
import type { IssuePoolData } from "@/lib/dashboard-data";
import { type SubmissionReview, cleanGithubHandle } from "@/lib/db-operations";

const BG_PAGE = "#fbfcfb";
const CHARCOAL = "#151b1d";
const BORDER = "#e4e4e7";
const MUTED = "#71717b";
const GREEN = "#257b5a";
const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";

type BizTab = "tasks-backlog" | "issue-pool" | "talent-pool" | "workspace" | "billing" | "profile";

export interface BizMetric {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
}

export interface BizTask {
  id: string;
  title: string;
  repo: string;
  budget: string;
  applicantsCount: number;
  status: "Active" | "Reviewing" | "Open for Bids" | "Queued";
  assignee?: string;
  priority: "Critical" | "High" | "Standard";
  targetRelease: string;
}

export interface BizContributor {
  id: string;
  name: string;
  githubHandle: string;
  reputation: number;
  mergedPRs: number;
  specialties: string[];
  status: "Available" | "Assigned" | "Top Contributor";
}

export interface BizDisbursal {
  id: string;
  date: string;
  recipient: string;
  taskTitle: string;
  amount: string;
  status: "Settled" | "Processing";
  txHash: string;
}

export interface BusinessDashboardData {
  displayName: string;
  displayEmail: string;
  githubHandle?: string | null;
  company?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  metrics: BizMetric[];
  backlogTasks: BizTask[];
  talentPool: BizContributor[];
  disbursals: BizDisbursal[];
}

export interface BusinessDashboardProps {
  data?: BusinessDashboardData;
  issuePool?: IssuePoolData;
  reviews?: SubmissionReview[];
}

const FALLBACK: BusinessDashboardData = {
  displayName: "Enterprise Sponsor",
  displayEmail: "biz@gig.dev",
  company: "Acme Enterprise Labs",
  bio: "Building next-generation open source distributed infrastructure and high-assurance web platforms.",
  location: "San Francisco, CA",
  avatar_url: null,
  metrics: [
    { label: "Active Engineering Bounties", value: "8", subtext: "4 in progress, 4 accepting bids", highlight: true },
    { label: "Vetted Talent Pool", value: "42", subtext: "Cryptographically certified contributors" },
    { label: "Escrow Vault Secured", value: "$32,500", subtext: "100% smart contract collateralized" },
    { label: "Avg PR Merge Velocity", value: "4.2 hrs", subtext: "Automated verification test pass" },
  ],
  backlogTasks: [
    { id: "task-b1", title: "Next.js 16 Turbopack Bundle Analyzer & Cache Optimizer", repo: "enterprise/core-runtime", budget: "$1,200 USDC", applicantsCount: 3, status: "Active", assignee: "Alex Rivers", priority: "Critical", targetRelease: "v0.2.0-rc1" },
    { id: "task-b2", title: "Zero-Knowledge Proof Merkle Tree Verification Engine", repo: "enterprise/zk-contracts", budget: "$2,500 USDC", applicantsCount: 6, status: "Open for Bids", priority: "High", targetRelease: "v0.2.0" },
    { id: "task-b3", title: "Automated Pull Request Proof-of-Work Evidence Auditor", repo: "enterprise/audit-suite", budget: "$950 USDC", applicantsCount: 1, status: "Reviewing", assignee: "Alex Rivers", priority: "High", targetRelease: "v0.1.9" },
    { id: "task-b4", title: "Multi-Region Distributed SQLite Sync & LibSQL Replica Gate", repo: "enterprise/storage-mesh", budget: "$3,200 USDC", applicantsCount: 0, status: "Queued", priority: "Standard", targetRelease: "v0.3.0" },
  ],
  talentPool: [
    { id: "dev-01", name: "Alex Rivers", githubHandle: "@alexrivers-gig", reputation: 98.4, mergedPRs: 24, specialties: ["Next.js 16", "React 19", "HMAC Auth", "TypeScript"], status: "Assigned" },
    { id: "dev-02", name: "Elena Rostova", githubHandle: "@erostova-crypto", reputation: 99.1, mergedPRs: 38, specialties: ["Rust", "ZK-SNARKs", "Elliptic Curve Cryptography"], status: "Top Contributor" },
    { id: "dev-03", name: "Marcus Chen", githubHandle: "@mchen-sys", reputation: 96.8, mergedPRs: 19, specialties: ["Distributed Systems", "Go", "LibSQL / SQLite"], status: "Available" },
    { id: "dev-04", name: "Priya Patel", githubHandle: "@ppatel-cloud", reputation: 97.5, mergedPRs: 31, specialties: ["Security Auditing", "CI/CD Pipelines", "Docker / K8s"], status: "Available" },
  ],
  disbursals: [
    { id: "dis-882", date: "2026-09-12", recipient: "Alex Rivers", taskTitle: "Implement HMAC-SHA256 Session Middleware Gate", amount: "$1,500 USDC", status: "Settled", txHash: "0x8f2a...4b19" },
    { id: "dis-879", date: "2026-09-10", recipient: "Elena Rostova", taskTitle: "Circuit Verification Module for Proof Generation", amount: "$2,500 USDC", status: "Settled", txHash: "0x4d19...3c22" },
    { id: "dis-865", date: "2026-09-08", recipient: "Alex Rivers", taskTitle: "Migrate Client Auth State to Async HTTP-Only Cookies", amount: "$1,200 USDC", status: "Settled", txHash: "0x3c7e...9a42" },
    { id: "dis-851", date: "2026-09-02", recipient: "Marcus Chen", taskTitle: "High-Concurrency Database Connection Pooling Engine", amount: "$1,800 USDC", status: "Settled", txHash: "0x9a7b...8821" },
  ],
};

function createEmptyBizIssuePool(): IssuePoolData {
  return {
    role: "business",
    displayName: "Enterprise Sponsor",
    initials: "CO",
    company: null,
    issues: [],
    openCount: 0,
    claimedByMe: 0,
    claimedTotal: 0,
    rewardTotal: 0,
    rewardCurrency: "INR",
    matchScore: "0%",
    matchLabel: "Engagement",
    matchSub: "of your issues claimed by devs",
    recommended: [],
    journey: [
      { num: 1, title: "Post issue", desc: "Create a task spec with clear acceptance criteria" },
      { num: 2, title: "Fund escrow", desc: "Rewards stay locked in the vault until verified" },
      { num: 3, title: "Review PRs", desc: "Inspect pull requests and accept merged work" },
      { num: 4, title: "Pay out", desc: "Verified contributions disburse straight to devs" },
    ],
  };
}

function Metrics({ metrics }: { metrics: BizMetric[] }) {
  return (
    <div className="biz-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
      {metrics.map((metric) => (
        <div key={metric.label} style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, boxShadow: CARD_SHADOW, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>{metric.label}</p>
            <p style={{ margin: "8px 0 0", fontSize: "2.25rem", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, color: metric.highlight ? GREEN : CHARCOAL }}>{metric.value}</p>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: MUTED, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>{metric.subtext}</p>
        </div>
      ))}
    </div>
  );
}

interface ProfileState {
  company: string;
  displayName: string;
  displayEmail: string;
  githubHandle: string;
  bio: string;
  location: string;
  avatar_url: string | null;
}

function TabContent({
  activeTab,
  data,
  issuePool,
  reviews,
  onOpenImportModal,
  profileState,
  isEditingProfile,
  setIsEditingProfile,
  profileForm,
  setProfileForm,
  savingProfile,
  profileSuccess,
  profileError,
  handleSaveProfile,
}: {
  activeTab: BizTab;
  data: BusinessDashboardData;
  issuePool?: IssuePoolData;
  reviews?: SubmissionReview[];
  onOpenImportModal: () => void;
  profileState: ProfileState;
  isEditingProfile: boolean;
  setIsEditingProfile: (val: boolean) => void;
  profileForm: ProfileState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileState>>;
  savingProfile: boolean;
  profileSuccess: string | null;
  profileError: string | null;
  handleSaveProfile: () => Promise<void>;
}) {
  const { metrics, backlogTasks, talentPool, disbursals } = data;

  switch (activeTab) {
    case "issue-pool":
      return (
        <IssuePool
          data={issuePool ?? createEmptyBizIssuePool()}
          role="business"
          onOpenImportModal={onOpenImportModal}
        />
      );

    case "tasks-backlog":
      return (
        <>
          <section id="overview" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <SectionHeading title="Workspace Overview & Metrics" sub="Real-time telemetry across all active bounties and contributors" />
            <Metrics metrics={metrics} />
          </section>

          <section id="tasks" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <SectionHeading
              title="Task Backlog & Post a Task"
              sub="Production task specifications, contributor assignments, and milestone deliverables"
              right={
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    style={{
                      height: 40,
                      padding: "0 18px",
                      borderRadius: 8,
                      backgroundColor: GREEN,
                      border: "none",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    + Import from GitHub
                  </button>
                </div>
              }
            />
            <Card><TaskTable tasks={backlogTasks} isBusiness={true} /></Card>
            {backlogTasks.length === 0 && (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: MUTED }}>No tasks posted yet. Click 'Import from GitHub' above to add your first issue.</p>
            )}
          </section>
        </>
      );

    case "talent-pool":
      return (
        <section id="talent" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
          <SectionHeading title="Contributor Talent Pool" sub="Verified top-tier software engineers with tamper-proof pull request track records" right={<span style={{ fontSize: 12, color: MUTED }}>{talentPool.length} Active Contributors Matched</span>} />
          <div className="biz-talent-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
            {talentPool.map((contributor) => <TalentCard key={contributor.id} contributor={contributor} />)}
          </div>
        </section>
      );

    case "workspace":
      return (
        <>
          <section id="overview" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <SectionHeading title="Workspace Overview & Metrics" sub="Real-time telemetry across all active bounties and contributors" />
            <Metrics metrics={metrics} />
          </section>

          <section id="reviews" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <SectionHeading title="Incoming Submissions" sub="Review pull requests and release escrow funds to verified contributors" />
            <SubmissionsReviewPanel reviews={reviews ?? []} />
          </section>

          <section id="activity" style={{ scrollMarginTop: 24 }}>
            <SectionHeading title="Recent Workspace Activity" sub="Latest updates across bounties, contributors, and disbursals" />
            <div style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}><h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL }}>Activity Feed</h3></div>
              <div style={{ padding: 20 }}>
                {disbursals.length === 0 ? (
                  <p style={{ margin: 0, color: MUTED }}>No disbursal activity yet.</p>
                ) : (
                  disbursals.slice(0, 4).map((d) => (
                    <div key={d.id} style={{ padding: "12px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: CHARCOAL }}>{d.recipient}</span> — {d.taskTitle}
                      <span style={{ color: MUTED }}> · {d.amount}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      );

    case "billing":
      return (
        <section id="billing" style={{ scrollMarginTop: 24 }}>
          <SectionHeading title="Escrow Account & Billing / Disbursals" sub="Deterministic escrow management, automated bounty disbursals, and on-chain receipts" />
          <EscrowCard disbursals={disbursals} vaultAmount="14,200" lockedAmount="4,800 Coins" disbursedAmount="9,400 Coins" nextInvoiceDate="Monthly (Next: Oct 1)" />
        </section>
      );

    case "profile":
      return (
        <section id="biz-profile" style={{ scrollMarginTop: 24 }}>
          <SectionHeading
            title="Company Profile & Enterprise Workspace"
            sub="Maintain organizational identity, verify multi-sig escrow status, and oversee connected repositories"
          />

          <div
            className="biz-profile-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "360px 1fr",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* Left Column: Organization Summary & Identity Card */}
            <div
              style={{
                backgroundColor: "#ffffff",
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                boxShadow: CARD_SHADOW,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* Company Avatar & Name Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {profileState.avatar_url ? (
                  <img
                    src={profileState.avatar_url}
                    alt={profileState.company || profileState.displayName}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      objectFit: "cover",
                      border: `1.5px solid ${BORDER}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 12,
                      backgroundColor: "#151b1d",
                      border: "1.5px solid rgba(0, 201, 80, 0.3)",
                      color: "#00c950",
                      fontSize: 22,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {(profileState.company || profileState.displayName)
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      color: CHARCOAL,
                      lineHeight: 1.2,
                    }}
                  >
                    {isEditingProfile ? profileForm.company || profileState.company : profileState.company || profileState.displayName}
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 13,
                      color: MUTED,
                      fontFamily: "monospace",
                    }}
                  >
                    {profileState.displayEmail}
                  </p>
                </div>
              </div>

              {/* Enterprise Sponsor Tier Badge */}
              <div
                style={{
                  backgroundColor: "rgba(0, 201, 80, 0.08)",
                  border: "1px solid rgba(0, 201, 80, 0.22)",
                  color: GREEN,
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>★</span>
                <span>Tier 1 Enterprise Sponsor · Multi-Sig Escrow Active</span>
              </div>

              {/* Status alerts */}
              {profileSuccess && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "rgba(0, 201, 80, 0.12)",
                    border: "1px solid rgba(0, 201, 80, 0.25)",
                    color: GREEN,
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  ✓ {profileSuccess}
                </div>
              )}
              {profileError && (
                <div
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  {profileError}
                </div>
              )}

              {/* Edit Toggle / Save Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                {!isEditingProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileForm({ ...profileState });
                      setIsEditingProfile(true);
                    }}
                    style={{
                      height: 38,
                      padding: "0 18px",
                      backgroundColor: "#00c950",
                      color: "#f0fdf4",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Edit Company Profile
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      disabled={savingProfile}
                      style={{
                        height: 38,
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
                        height: 38,
                        padding: "0 18px",
                        backgroundColor: "#00c950",
                        color: "#f0fdf4",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: savingProfile ? "not-allowed" : "pointer",
                        opacity: savingProfile ? 0.7 : 1,
                      }}
                    >
                      {savingProfile ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                )}
              </div>

              {/* View Mode Content */}
              {!isEditingProfile ? (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Mission / Bio */}
                  <div>
                    <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Company Mission / Bio
                    </span>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: CHARCOAL, lineHeight: 1.5 }}>
                      {profileState.bio || "No mission description provided yet. Click 'Edit Company Profile' to add your organization's mission."}
                    </p>
                  </div>

                  {/* Metadata key-value rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #f4f4f5", paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: MUTED }}>Organization</span>
                      <span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.company || profileState.displayName}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: MUTED }}>Location</span>
                      <span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.location || "San Francisco, CA"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: MUTED }}>Admin Email</span>
                      <span style={{ fontWeight: 600, color: CHARCOAL }}>{profileState.displayEmail}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: MUTED }}>Escrow Collateral</span>
                      <span style={{ fontWeight: 700, color: GREEN }}>$32,500 USDC</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: MUTED }}>Partner Status</span>
                      <span style={{ fontWeight: 600, color: CHARCOAL }}>Enterprise Partner since 2024</span>
                    </div>
                  </div>

                  {/* GitHub Connected Badge */}
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                    <span style={{ color: MUTED, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      GitHub Organization
                    </span>
                    <div style={{ marginTop: 8 }}>
                      {cleanGithubHandle(profileState.githubHandle) ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                          <a
                            href={`https://github.com/${cleanGithubHandle(profileState.githubHandle)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 14px",
                              backgroundColor: "rgba(0, 201, 80, 0.08)",
                              color: GREEN,
                              fontWeight: 600,
                              fontSize: 13,
                              border: "1px solid rgba(0, 201, 80, 0.20)",
                              borderRadius: 6,
                              textDecoration: "none",
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
                            <span>@{cleanGithubHandle(profileState.githubHandle)}</span>
                          </a>
                          <span style={{ fontSize: 11, color: MUTED }}>Verified Organization</span>
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
                            Connect your organization&apos;s GitHub account to import repositories directly into the Issue Pool and verify contributor pull requests.
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
                              Connect GitHub Organization
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Edit Mode Form */
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>
                      Company / Organization Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.company || ""}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, company: e.target.value, displayName: e.target.value }))}
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
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>
                      Company Mission / Bio
                    </label>
                    <textarea
                      value={profileForm.bio || ""}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
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
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>
                      Location
                    </label>
                    <input
                      type="text"
                      value={profileForm.location || ""}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g. San Francisco, CA"
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
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>
                      Company Avatar / Logo URL
                    </label>
                    <input
                      type="text"
                      value={profileForm.avatar_url || ""}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, avatar_url: e.target.value }))}
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
                    {profileForm.avatar_url && (
                      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: MUTED }}>Preview:</span>
                        <img
                          src={profileForm.avatar_url}
                          alt="Preview"
                          style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: `1px solid ${BORDER}` }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: CHARCOAL, fontWeight: 600 }}>
                      GitHub Organization Handle
                    </label>
                    <input
                      type="text"
                      value={profileForm.githubHandle || ""}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, githubHandle: e.target.value }))}
                      placeholder="e.g. acme-corp"
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
              )}
            </div>

            {/* Right Column: Mission Scope, Bounties, and Talent */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Card 1: Enterprise Engineering Scope */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  boxShadow: CARD_SHADOW,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${BORDER}`,
                    backgroundColor: "rgba(0,0,0,0.02)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: CHARCOAL }}>
                    Enterprise Engineering Scope & Escrow Protocol
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: GREEN,
                      backgroundColor: "rgba(0, 201, 80, 0.08)",
                      padding: "3px 10px",
                      borderRadius: 9999,
                    }}
                  >
                    100% COLLATERALIZED
                  </span>
                </div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                    All tasks funded by {profileState.company || profileState.displayName} execute under deterministic smart-contract escrow.
                    Acceptance criteria and proof-of-work benchmarks are verified via automated CI pipelines before funds release to vetted contributors.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 12,
                      borderTop: `1px solid ${BORDER}`,
                      paddingTop: 16,
                    }}
                  >
                    <div style={{ backgroundColor: "#f9fafb", padding: "12px 14px", borderRadius: 8, border: "1px solid #f0f0f2" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: MUTED }}>Active Bounties</span>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: GREEN }}>{backlogTasks.length}</p>
                    </div>
                    <div style={{ backgroundColor: "#f9fafb", padding: "12px 14px", borderRadius: 8, border: "1px solid #f0f0f2" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: MUTED }}>Matched Talent</span>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: CHARCOAL }}>{talentPool.length}</p>
                    </div>
                    <div style={{ backgroundColor: "#f9fafb", padding: "12px 14px", borderRadius: 8, border: "1px solid #f0f0f2" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: MUTED }}>Merge Velocity</span>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: CHARCOAL }}>4.2 hrs</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Connected Repositories & Active Bounties */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  boxShadow: CARD_SHADOW,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${BORDER}`,
                    backgroundColor: "rgba(0,0,0,0.02)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: CHARCOAL }}>
                    Connected Repositories & Engineering Backlog
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenImportModal}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      backgroundColor: GREEN,
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    + Import Repo
                  </button>
                </div>
                <div>
                  {backlogTasks.length === 0 ? (
                    <p style={{ padding: 20, margin: 0, fontSize: 13, color: MUTED }}>No active bounties or connected repositories.</p>
                  ) : (
                    backlogTasks.map((t, idx) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                          padding: "14px 20px",
                          borderTop: idx === 0 ? "none" : `1px solid ${BORDER}`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, color: CHARCOAL, fontSize: 14 }}>{t.title}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED, fontFamily: "monospace" }}>
                            {t.repo} · {t.applicantsCount} applicant{t.applicantsCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>{t.budget}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 4,
                              backgroundColor: t.status === "Active" ? "rgba(0, 201, 80, 0.10)" : "#f4f4f5",
                              color: t.status === "Active" ? GREEN : CHARCOAL,
                              border: `1px solid ${BORDER}`,
                            }}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Card 3: Vetted Engineering Talent Pool */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  boxShadow: CARD_SHADOW,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${BORDER}`,
                    backgroundColor: "rgba(0,0,0,0.02)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: CHARCOAL }}>
                    Vetted Talent Network
                  </h3>
                  <span style={{ fontSize: 12, color: MUTED }}>{talentPool.length} Certified Contributors</span>
                </div>
                <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  {talentPool.slice(0, 4).map((dev) => (
                    <div
                      key={dev.id}
                      style={{
                        padding: 12,
                        backgroundColor: "#f9fafb",
                        border: "1px solid #f0f0f2",
                        borderRadius: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: CHARCOAL, fontSize: 13 }}>{dev.name}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: MUTED, fontFamily: "monospace" }}>{dev.githubHandle}</p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, backgroundColor: "rgba(0, 201, 80, 0.08)", padding: "2px 6px", borderRadius: 4 }}>
                          ★ {dev.reputation}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {dev.specialties.slice(0, 2).map((s) => (
                          <span key={s} style={{ fontSize: 10, backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, padding: "1px 6px", borderRadius: 4, color: MUTED }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
  }
}

export default function BusinessDashboard({ data = FALLBACK, issuePool, reviews }: BusinessDashboardProps) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeTab: BizTab = (() => {
    const tab = searchParams?.get("tab") as BizTab;
    return tab && ["tasks-backlog", "issue-pool", "talent-pool", "workspace", "billing", "profile"].includes(tab) ? tab : "tasks-backlog";
  })();

  // Company profile state
  const initialGithubHandle = cleanGithubHandle(data.githubHandle) || "";
  const [profileState, setProfileState] = useState<ProfileState>({
    company: data.company || data.displayName || FALLBACK.company || "Acme Enterprise Labs",
    displayName: data.displayName || FALLBACK.displayName,
    displayEmail: data.displayEmail || FALLBACK.displayEmail,
    githubHandle: initialGithubHandle,
    bio: data.bio || FALLBACK.bio || "",
    location: data.location || FALLBACK.location || "",
    avatar_url: data.avatar_url || null,
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileState>({ ...profileState });

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const cleanHandle = cleanGithubHandle(profileForm.githubHandle);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: profileForm.company,
          username: profileForm.displayName,
          bio: profileForm.bio,
          location: profileForm.location,
          avatar_url: profileForm.avatar_url,
          github_handle: cleanHandle,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to update profile: ${res.status}`);
      }

      setProfileState({ ...profileForm });
      setIsEditingProfile(false);
      setProfileSuccess("Company profile updated successfully!");
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, color: CHARCOAL }}>
      <style>{`
        @media (max-width: 1024px) {
          .biz-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .biz-escrow-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .biz-profile-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .biz-page-wrap { padding: 24px 16px 64px !important; }
          .biz-metrics-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .biz-talent-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .biz-profile-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
      <div className="biz-page-wrap" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 36px 80px" }}>
        {activeTab === "issue-pool" ? null : (
          <BizHeader
            displayName={profileState.company || profileState.displayName}
            displayEmail={profileState.displayEmail}
            activeTab={activeTab}
            githubHandle={profileState.githubHandle}
          />
        )}
        <TabContent
          activeTab={activeTab}
          data={data}
          issuePool={issuePool}
          reviews={reviews}
          onOpenImportModal={() => setImportModalOpen(true)}
          profileState={profileState}
          isEditingProfile={isEditingProfile}
          setIsEditingProfile={setIsEditingProfile}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          savingProfile={savingProfile}
          profileSuccess={profileSuccess}
          profileError={profileError}
          handleSaveProfile={handleSaveProfile}
        />
      </div>

      <GitHubImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}