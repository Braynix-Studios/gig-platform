"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useActionState } from "react";
import type { IssuePoolData } from "@/lib/dashboard-data";
import type { IssuePoolIssue } from "@/lib/dashboard-data";
import {
  claimIssueAction,
  submitPrAction,
  type DevLoopState,
} from "@/app/actions/dev-loop";
import CreateIssueModal from "@/components/dashboard/CreateIssueModal";

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

type SortKey = "newest" | "reward-desc" | "reward-asc" | "difficulty-hard";

interface IssuePoolProps {
  data: IssuePoolData;
  role: "developer" | "business";
  onOpenImportModal?: () => void;
}

function currency(amount: number): string {
  return `\u20b9${(amount || 0).toLocaleString("en-IN")}`;
}

function buttonLike(bg: string, fg: string): React.CSSProperties {
  return {
    height: 44,
    padding: "0 22px",
    borderRadius: 8,
    backgroundColor: bg,
    border: "none",
    color: fg,
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.02em",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };
}

function difficultyTone(difficulty: string): { bg: string; color: string; border: string } {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    easy: { bg: MINT_SOFT, color: GREEN, border: MINT_BDR },
    medium: { bg: "rgba(246, 182, 11, 0.12)", color: "#c98a00", border: "rgba(246, 182, 11, 0.28)" },
    hard: { bg: "rgba(234, 67, 53, 0.12)", color: "#ea4335", border: "rgba(234, 67, 53, 0.28)" },
  };
  return map[difficulty] || { bg: "rgba(113,113,123,0.08)", color: MUTED, border: BORDER };
}

function difficultyLabel(difficulty: string): string {
  const map: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard", standard: "Standard" };
  return map[difficulty] || difficulty;
}

function iconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function iconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function iconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}

function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: `1px solid ${highlight ? MINT_BDR : BORDER}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: CARD_SHADOW,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>{label}</p>
        <p style={{ margin: "8px 0 0", fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, color: highlight ? GREEN : CHARCOAL }}>{value}</p>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: MUTED, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>{sub}</p>
    </div>
  );
}

function Chip({ label, tone, uppercase }: { label: string; tone: { bg: string; color: string; border: string }; uppercase?: boolean }) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 9999,
        backgroundColor: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontSize: 11,
        fontWeight: uppercase ? 700 : 600,
        textTransform: uppercase ? "uppercase" : "none",
        letterSpacing: uppercase ? "0.05em" : 0,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function TechChip({ label }: { label: string }) {
  return <Chip label={label} tone={{ bg: MINT_SOFT, color: GREEN, border: MINT_BDR }} />;
}

function DifficultyChip({ label }: { label: string }) {
  return <Chip label={difficultyLabel(label)} tone={difficultyTone(label)} uppercase />;
}

function ClaimedChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 9999,
        backgroundColor: "rgba(96, 72, 168, 0.12)",
        border: "1px solid rgba(96, 72, 168, 0.28)",
        color: "#6048a8",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: "#6048a8", flexShrink: 0 }} />
      Claimed by you
    </span>
  );
}

function SubmittedChip() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 9999,
        backgroundColor: MINT_SOFT,
        border: `1px solid ${MINT_BDR}`,
        color: GREEN,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: MINT, flexShrink: 0 }} />
      PR submitted
    </span>
  );
}

const INITIAL_STATE: DevLoopState = { ok: true };

interface DevIssueActionsProps {
  issue: IssuePoolIssue;
  onOptimistic: (taskId: string, kind: "claimed" | "submitted") => void;
}

function DevIssueActions({ issue, onOptimistic }: DevIssueActionsProps) {
  const [claimState, claimAction, claimPending] = useActionState(claimIssueAction, INITIAL_STATE);
  const [submitState, submitAction, submitPending] = useActionState(submitPrAction, INITIAL_STATE);

  const claimButtonStyle: React.CSSProperties = {
    ...buttonLike(MINT, "#ffffff"),
    height: 36,
    padding: "0 16px",
    fontSize: 13,
    opacity: claimPending ? 0.6 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      {!issue.claimedByMe ? (
        <form
          action={(formData) => {
            // Instant UI feedback; the server revalidation confirms it.
            onOptimistic(issue.id, "claimed");
            claimAction(formData);
          }}
        >
          <input type="hidden" name="taskId" value={issue.id} />
          <button type="submit" disabled={claimPending} style={claimButtonStyle}>
            {claimPending ? "Claiming…" : "Claim issue"}
          </button>
        </form>
      ) : !issue.submittedByMe ? (
        <form
          action={(formData) => {
            onOptimistic(issue.id, "submitted");
            submitAction(formData);
          }}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}
        >
          <input type="hidden" name="taskId" value={issue.id} />
          <input
            name="prUrl"
            type="url"
            required
            placeholder="https://github.com/…/pull/12"
            aria-label="Pull request URL"
            style={{
              width: 260,
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: `1.5px solid ${BORDER}`,
              fontSize: 13,
              color: CHARCOAL,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={submitPending}
            style={{
              ...buttonLike("#ffffff", GREEN),
              height: 36,
              padding: "0 16px",
              fontSize: 13,
              border: `1.5px solid ${GREEN}`,
              opacity: submitPending ? 0.6 : 1,
            }}
          >
            {submitPending ? "Submitting…" : "Submit PR"}
          </button>
        </form>
      ) : (
        <span
          style={{
            height: 36,
            padding: "0 16px",
            borderRadius: 8,
            backgroundColor: MINT_FG,
            border: `1.5px solid ${MINT_BDR}`,
            color: GREEN,
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
        >
          Submitted for verification
        </span>
      )}

      {(claimState?.message || submitState?.message) && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: claimState.ok && submitState.ok ? GREEN : "#ea4335",
            lineHeight: 1.4,
            maxWidth: 320,
            textAlign: "right",
          }}
        >
          {claimState?.message || submitState?.message}
        </span>
      )}
    </div>
  );
}

export default function IssuePool({ data, role, onOpenImportModal }: IssuePoolProps) {
   const [createModalOpen, setCreateModalOpen] = useState(false);
   const [query, setQuery] = useState("");
   const [skill, setSkill] = useState("all");
   const [difficulty, setDifficulty] = useState("all");
   const [sort, setSort] = useState<SortKey>("newest");
   const [page, setPage] = useState(1);
   const [pageSize, setPageSize] = useState(5);
   const base = role === "business" ? "/dashboard/business" : "/dashboard/developer";

  // Optimistic list state: claims/submits reflect instantly while the
  // server action + revalidation completes in the background.
  type OptimisticUpdate = { taskId: string; kind: "claimed" | "submitted" };
  const [optimisticIssues, markOptimistic] = useOptimistic(
    data.issues,
    (state: IssuePoolIssue[], update: OptimisticUpdate) =>
      state.map((issue) =>
        issue.id === update.taskId
          ? {
              ...issue,
              claimedByMe: update.kind === "claimed" ? true : issue.claimedByMe,
              submittedByMe: update.kind === "submitted" ? true : issue.submittedByMe,
            }
          : issue,
      ),
  );
  const handleOptimistic = (taskId: string, kind: "claimed" | "submitted") =>
    markOptimistic({ taskId, kind });

  const skills = useMemo(() => {
    const all = data.issues.map((issue) => issue.technology).filter((t): t is string => Boolean(t));
    return Array.from(new Set(all)).sort();
  }, [data.issues]);

  const filtered = useMemo(() => {
    let list = optimisticIssues.filter((issue) => {
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = `${issue.title} ${issue.repo} ${issue.tags.join(" ")} ${issue.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (skill !== "all" && issue.technology !== skill) return false;
      if (difficulty !== "all" && issue.difficulty !== difficulty) return false;
      return true;
    });

    const rank: Record<string, number> = { hard: 0, medium: 1, easy: 2, standard: 3 };
    switch (sort) {
      case "reward-desc":
        list = [...list].sort((a, b) => b.reward - a.reward);
        break;
      case "reward-asc":
        list = [...list].sort((a, b) => a.reward - b.reward);
        break;
      case "difficulty-hard":
        list = [...list].sort((a, b) => (rank[a.difficulty] ?? 9) - (rank[b.difficulty] ?? 9));
        break;
      case "newest":
      default:
        list = [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        break;
    }
    return list;
  }, [optimisticIssues, query, skill, difficulty, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const metrics = useMemo(() => {
    if (role === "business") {
      return [
        { label: "Open issues", value: String(data.openCount), sub: data.company ? `raised by ${data.company}` : "raised by your company", highlight: false },
        { label: "Claimed by devs", value: String(data.claimedTotal), sub: "active locks across your issues", highlight: false },
        { label: "Rewards committed", value: currency(data.rewardTotal), sub: "locked in escrow till verification", highlight: false },
        { label: "Engagement", value: data.matchScore, sub: "of your issues claimed by devs", highlight: true },
      ];
    }
    return [
      { label: "Open issues", value: String(data.openCount), sub: "available to claim right now", highlight: false },
      { label: "My claimed issues", value: String(data.claimedByMe), sub: "active locks with 48h expiry", highlight: false },
      { label: "Available rewards", value: currency(data.rewardTotal), sub: "across the issue pool", highlight: false },
      { label: "Match score", value: data.matchScore, sub: "how well your profile fits the pool", highlight: true },
    ];
  }, [role, data]);

  const resetPage = () => setPage(1);

  const selectStyle: React.CSSProperties = {
    height: 40,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    backgroundColor: "#ffffff",
    color: CHARCOAL,
    fontSize: 13,
    fontWeight: 500,
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, color: CHARCOAL }}>
      <style>{`
        @media (max-width: 1024px) {
          .ip-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 960px) {
          .ip-layout { grid-template-columns: minmax(0, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .ip-page-wrap { padding: 24px 16px 64px !important; }
          .ip-summary-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .ip-toolbar-controls { width: 100% !important; flex-wrap: wrap !important; }
          .ip-toolbar-controls select { flex: 1 1 40% !important; }
        }
      `}</style>
      <div className="ip-page-wrap" style={{ maxWidth: 1160, margin: "0 auto", padding: "28px 36px 80px" }}>
        {/* Utility header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            paddingBottom: 16,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: MUTED }}>
              <Link href={base} style={{ color: MUTED, textDecoration: "none" }}>Dashboard</Link>
              {" / "}
              <span style={{ color: CHARCOAL, fontWeight: 600 }}>Issue Pool</span>
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 9999,
                backgroundColor: MINT_SOFT,
                border: `1px solid ${MINT_BDR}`,
                color: GREEN,
                fontSize: 11,
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: MINT, flexShrink: 0 }} />
              Last synced 2 min ago
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: 8,
                backgroundColor: "#ffffff",
                border: `1px solid ${BORDER}`,
                color: CHARCOAL,
                fontSize: 13,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {iconRefresh()}
              Refresh issues
            </button>
            <button
              type="button"
              aria-label="Notifications"
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: "#ffffff",
                border: `1px solid ${BORDER}`,
                color: MUTED,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {iconBell()}
            </button>
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: "#eee8ff",
                border: "1px solid #c8b8f1",
                color: "#6048a8",
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {data.initials}
            </span>
          </div>
        </header>

        {/* Heading */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 28,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, color: CHARCOAL }}>
              Issue Pool
            </h1>
            <p style={{ margin: "8px 0 0", maxWidth: 520, fontSize: "0.875rem", lineHeight: 1.55, color: MUTED }}>
              {role === "business"
                ? `Live issues raised by ${data.company ?? "your company"}, ready for developers to claim and ship.`
                : "Browse every open issue across the network, claim what fits, and earn verified rewards."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {role === "business" && onOpenImportModal && (
              <button
                type="button"
                onClick={onOpenImportModal}
                style={{
                  ...buttonLike("#ffffff", CHARCOAL),
                  border: `1px solid ${BORDER}`,
                }}
              >
                Sync GitHub Repo
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              style={buttonLike(MINT, MINT_FG)}
            >
              + Post New Issue
            </button>
          </div>
        </div>

        {/* Summary metrics */}
        <section className="ip-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginTop: 24 }}>
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        {/* Main layout */}
        <div className="ip-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 20, marginTop: 28, alignItems: "start" }}>
          {/* Available issues */}
          <section style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL }}>Available issues</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED }}>
                  {filtered.length} of {data.openCount} matching {role === "business" ? "issues raised by you" : "open issues"}
                </p>
              </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.015)", flexWrap: "wrap" }}>
              <div style={{ position: "relative", minWidth: 220, flex: "1 1 220px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED, display: "flex", pointerEvents: "none" }}>{iconSearch()}</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); resetPage(); }}
                  placeholder="Search by title or repository..."
                  aria-label="Search issues"
                  style={{
                    width: "100%",
                    height: 40,
                    padding: "0 12px 0 36px",
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    backgroundColor: "#ffffff",
                    fontSize: 13,
                    color: CHARCOAL,
                    outline: "none",
                  }}
                />
              </div>
              <div className="ip-toolbar-controls" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <select value={skill} onChange={(e) => { setSkill(e.target.value); resetPage(); }} aria-label="Filter by skill" style={selectStyle}>
                  <option value="all">All skills</option>
                  {skills.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select value={difficulty} onChange={(e) => { setDifficulty(e.target.value); resetPage(); }} aria-label="Filter by difficulty" style={selectStyle}>
                  <option value="all">All difficulty</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select value={sort} onChange={(e) => { setSort(e.target.value as SortKey); resetPage(); }} aria-label="Sort issues" style={selectStyle}>
                  <option value="newest">Newest first</option>
                  <option value="reward-desc">Reward: high to low</option>
                  <option value="reward-asc">Reward: low to high</option>
                  <option value="difficulty-hard">Difficulty: hard first</option>
                </select>
              </div>
            </div>

            {/* Issue rows */}
            {visible.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: CHARCOAL }}>No matching issues</p>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>Try clearing your search or filters to see more issues.</p>
              </div>
            ) : (
              <div>
                {visible.map((issue, idx) => (
                  <div
                    key={issue.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 20,
                      padding: "16px 20px",
                      borderTop: idx === 0 ? "none" : `1px solid ${BORDER}`,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ margin: 0, fontWeight: 600, color: CHARCOAL, lineHeight: 1.4, fontSize: 14 }}>{issue.title}</p>
                        {role === "developer" && issue.claimedByMe && <ClaimedChip />}
                        {role === "developer" && issue.submittedByMe && <SubmittedChip />}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
                        {issue.repo} · {issue.timeAgo}
                      </p>
                      {issue.description && (
                        <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.5, maxWidth: 560 }}>
                          {issue.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
                      {role === "developer" && <DevIssueActions issue={issue} onOptimistic={handleOptimistic} />}
                      {issue.technology && <TechChip label={issue.technology} />}
                      <DifficultyChip label={issue.difficulty} />
                      <span style={{ fontSize: 15, fontWeight: 800, color: GREEN, whiteSpace: "nowrap" }}>{currency(issue.reward)}</span>
                      {issue.issueUrl ? (
                        <a
                          href={issue.issueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            height: 36,
                            padding: "0 16px",
                            borderRadius: 8,
                            backgroundColor: "#ffffff",
                            border: `1.5px solid ${GREEN}`,
                            color: GREEN,
                            fontSize: 13,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                          }}
                        >
                          View issue
                        </a>
                      ) : (
                        <span
                          style={{
                            height: 36,
                            padding: "0 16px",
                            borderRadius: 8,
                            backgroundColor: "#ffffff",
                            border: `1.5px solid ${BORDER}`,
                            color: MUTED,
                            fontSize: 13,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          View issue
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderTop: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.015)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: MUTED }}>
                Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1); // Reset to first page when changing page size
                  }}
                  aria-label="Issues per page"
                  style={{ ...selectStyle, height: 34 }}
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 8,
                    backgroundColor: "#ffffff",
                    border: `1px solid ${BORDER}`,
                    color: CHARCOAL,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                    opacity: currentPage <= 1 ? 0.5 : 1,
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, color: MUTED, minWidth: 30, textAlign: "center" }}>
                  {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= pageCount}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: 8,
                    backgroundColor: "#ffffff",
                    border: `1px solid ${BORDER}`,
                    color: CHARCOAL,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: currentPage >= pageCount ? "not-allowed" : "pointer",
                    opacity: currentPage >= pageCount ? 0.5 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          {/* Right rail */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Journey */}
            <section style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: CHARCOAL }}>Your issue journey</h3>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                {data.journey.map((step) => (
                  <div key={step.num} style={{ display: "flex", gap: 12, padding: "8px 4px" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9999,
                        backgroundColor: MINT_SOFT,
                        border: `1px solid ${MINT_BDR}`,
                        color: GREEN,
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {step.num}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{step.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recommended */}
            <section style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: CHARCOAL }}>
                  {role === "business" ? "Your repositories" : "Recommended for you"}
                </h3>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                {data.recommended.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Nothing to show yet.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {data.recommended.map((item) => (
                      <TechChip key={item} label={item} />
                    ))}
                  </div>
                )}
                <Link
                  href={`${base}?tab=${role === "business" ? "tasks-backlog" : "profile"}`}
                  style={{
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: "transparent",
                    border: `1.5px solid ${CHARCOAL}`,
                    color: CHARCOAL,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  {role === "business" ? "Post a new issue" : "Update profile"}
                </Link>
              </div>
            </section>

            {/* Guidelines */}
            <section style={{ backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: CARD_SHADOW, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "rgba(0,0,0,0.02)" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: CHARCOAL }}>Issue pool guidelines</h3>
              </div>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { title: "One active claim per issue", desc: "Claim an issue to lock it — release it if you move on." },
                  { title: "48-hour lock window", desc: "Submit your PR before the lock expires to keep the reward." },
                  { title: "Verified PRs only", desc: "Rewards disburse after a maintainer merges your pull request." },
                ].map((rule, idx) => (
                  <div key={rule.title} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        backgroundColor: MINT_SOFT,
                        border: `1px solid ${MINT_BDR}`,
                        color: GREEN,
                        fontSize: 11,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: CHARCOAL }}>{rule.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>{rule.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {/* On-chain banner */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 32,
            padding: "18px 24px",
            borderRadius: 12,
            backgroundColor: MINT_SOFT,
            border: `1px solid ${MINT_BDR}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "#ffffff",
                border: `1px solid ${MINT_BDR}`,
                color: GREEN,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: CHARCOAL }}>Issue activity is recorded on-chain</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.45 }}>
                Every claim and verified pull request is written to the public audit record before any reward is released.
              </p>
            </div>
          </div>
          <Link
            href={`${base}?tab=${role === "business" ? "workspace" : "prs"}`}
            style={{ fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            View audit record &rarr;
          </Link>
        </div>
      </div>

      <CreateIssueModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        userRole={role}
      />
    </div>
  );
}