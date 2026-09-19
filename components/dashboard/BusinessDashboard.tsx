"use client";

import { useSearchParams } from "next/navigation";
import BizHeader from "@/components/dashboard/BizHeader";
import SectionHeading from "@/components/dashboard/SectionHeading";
import TaskTable from "@/components/dashboard/TaskTable";
import TalentCard from "@/components/dashboard/TalentCard";
import EscrowCard from "@/components/dashboard/EscrowCard";
import MintButton from "@/components/dashboard/MintButton";
import Card from "@/components/dashboard/Card";
import IssuePool from "@/components/dashboard/IssuePool";
import SubmissionsReviewPanel from "@/components/dashboard/SubmissionsReviewPanel";
import type { IssuePoolData } from "@/lib/dashboard-data";
import type { SubmissionReview } from "@/lib/db-operations";

const BG_PAGE = "#fbfcfb";
const CHARCOAL = "#151b1d";
const BORDER = "#e4e4e7";
const MUTED = "#71717b";
const GREEN = "#257b5a";
const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";

type BizTab = "tasks-backlog" | "issue-pool" | "talent-pool" | "workspace" | "billing";

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

function TabContent({ activeTab, data, issuePool, reviews }: { activeTab: BizTab; data: BusinessDashboardData; issuePool?: IssuePoolData; reviews?: SubmissionReview[] }) {
  const { metrics, backlogTasks, talentPool, disbursals } = data;

  switch (activeTab) {
    case "issue-pool":
      return <IssuePool data={issuePool ?? createEmptyBizIssuePool()} role="business" />;

    case "tasks-backlog":
      return (
        <>
          <section id="overview" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <SectionHeading title="Workspace Overview & Metrics" sub="Real-time telemetry across all active bounties and contributors" />
            <Metrics metrics={metrics} />
          </section>

          <section id="tasks" style={{ marginBottom: 40, scrollMarginTop: 24 }}>
            <SectionHeading title="Task Backlog & Post a Task" sub="Production task specifications, contributor assignments, and milestone deliverables" right={<MintButton href="/dashboard/business?tab=tasks-backlog">Create Task Spec</MintButton>} />
            <Card><TaskTable tasks={backlogTasks} isBusiness={true} /></Card>
            {backlogTasks.length === 0 && (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: MUTED }}>No tasks posted yet. Create your first task spec above.</p>
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
          <SectionHeading title="Escrow Account & Billing / Disbursals" sub="Deterministic escrow management, automated bounty disbursals, and on-chain receipts" right={<MintButton href="/dashboard/business?tab=billing">Deposit Treasury Funds</MintButton>} />
          <EscrowCard disbursals={disbursals} vaultAmount="$32,500" lockedAmount="$14,200 USDC" disbursedAmount="$18,300 USDC" nextInvoiceDate="Monthly (Next: Oct 1)" />
        </section>
      );
  }
}

export default function BusinessDashboard({ data = FALLBACK, issuePool, reviews }: BusinessDashboardProps) {
  const searchParams = useSearchParams();
  const activeTab: BizTab = (() => {
    const tab = searchParams?.get("tab") as BizTab;
    return tab && ["tasks-backlog", "issue-pool", "talent-pool", "workspace", "billing"].includes(tab) ? tab : "tasks-backlog";
  })();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, color: CHARCOAL }}>
      <style>{`
        @media (max-width: 1024px) {
          .biz-metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .biz-escrow-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .biz-page-wrap { padding: 24px 16px 64px !important; }
          .biz-metrics-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .biz-talent-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
      <div className="biz-page-wrap" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 36px 80px" }}>
        {activeTab === "issue-pool" ? null : (
          <BizHeader
            displayName={data.displayName}
            displayEmail={data.displayEmail}
            activeTab={activeTab}
            githubHandle={data.githubHandle}
          />
        )}
        <TabContent activeTab={activeTab} data={data} issuePool={issuePool} reviews={reviews} />
      </div>
    </div>
  );
}