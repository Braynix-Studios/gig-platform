"use client";

import { useActionState } from "react";
import type { SubmissionReview } from "@/lib/db-operations";
import {
  reviewSubmissionAction,
  type BusinessReviewState,
} from "@/app/actions/business-loop";
import { timeAgo } from "@/lib/dashboard-data";

const CHARCOAL = "#151b1d";
const BORDER = "#e4e4e7";
const MUTED = "#71717b";
const GREEN = "#257b5a";
const MINT = "#00c950";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";
const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";

const INITIAL_STATE: BusinessReviewState = { ok: true };

function currency(amount: number | null | undefined, code: string): string {
  if (code === "INR") return `\u20b9${(amount ?? 0).toLocaleString("en-IN")}`;
  return `$${(amount ?? 0).toLocaleString("en-US")}`;
}

function ReviewRow({ review }: { review: SubmissionReview }) {
  const [state, action, pending] = useActionState(reviewSubmissionAction, INITIAL_STATE);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 20px",
        borderTop: `1px solid ${BORDER}`,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {review.user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.user.avatar_url}
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: 9999 }}
            />
          ) : (
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                backgroundColor: MINT_SOFT,
                color: GREEN,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {(review.user?.username || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span style={{ fontWeight: 600, color: CHARCOAL, fontSize: 13 }}>
            {review.user?.username ?? "developer"}
          </span>
          <span style={{ fontSize: 11, color: MUTED, fontFamily: "monospace" }}>
            {review.task.repository_owner}/{review.task.repository_name}
          </span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: CHARCOAL }}>
          {review.task.title}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
          <a
            href={review.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: GREEN, fontWeight: 600, textDecoration: "none" }}
          >
            PR #{review.pr_number ?? "—"}
          </a>{" "}
          · requested {timeAgo(review.submitted_at)} · reward{" "}
          {currency(review.task.reward_amount, review.task.reward_currency)}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input type="hidden" name="submissionId" value={review.id} />
          <button
            type="submit"
            name="decision"
            value="approve"
            disabled={pending}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              backgroundColor: MINT,
              border: "none",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {pending ? "Working…" : "Approve & pay out"}
          </button>
          <button
            type="submit"
            name="decision"
            value="reject"
            disabled={pending}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              backgroundColor: "#ffffff",
              border: `1.5px solid ${BORDER}`,
              color: MUTED,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            Reject
          </button>
        </form>
        {state?.message && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: state.ok ? GREEN : "#ea4335",
              lineHeight: 1.4,
              maxWidth: 340,
              textAlign: "right",
            }}
          >
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}

interface SubmissionsReviewPanelProps {
  reviews: SubmissionReview[];
}

export default function SubmissionsReviewPanel({ reviews }: SubmissionsReviewPanelProps) {
  return (
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
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: CHARCOAL }}>
          Pending PR Verification
        </h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 10px",
            borderRadius: 9999,
            backgroundColor: MINT_SOFT,
            border: `1px solid ${MINT_BDR}`,
            color: GREEN,
          }}
        >
          {reviews.length} awaiting review
        </span>
      </div>
      {reviews.length === 0 ? (
        <p style={{ margin: 0, padding: 20, fontSize: 13, color: MUTED }}>
          No pull requests awaiting review. When a developer submits a PR against your issues, it
          lands here for escrow payout.
        </p>
      ) : (
        reviews.map((review) => <ReviewRow key={review.id} review={review} />)
      )}
    </div>
  );
}