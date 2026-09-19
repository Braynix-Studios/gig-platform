"use client";

import Link from "next/link";

const BORDER = "#e4e4e7";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";
const GREEN = "#257b5a";
const VIOLET = "#6048a8";
const VIOLET_SOFT = "rgba(96, 72, 168, 0.12)";
const VIOLET_BDR = "rgba(96, 72, 168, 0.28)";

interface TalentContributor {
  id: string;
  name: string;
  githubHandle: string;
  reputation: number;
  mergedPRs: number;
  specialties: string[];
  status: "Available" | "Assigned" | "Top Contributor";
}

function contributorStatus(status: TalentContributor["status"]) {
  const map: Record<TalentContributor["status"], { bg: string; color: string; border: string }> = {
    "Top Contributor": { bg: MINT_SOFT, color: GREEN, border: MINT_BDR },
    Assigned: { bg: VIOLET_SOFT, color: VIOLET, border: VIOLET_BDR },
    Available: { bg: "rgba(113,113,123,0.08)", color: MUTED, border: BORDER },
  };
  const s = map[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 9999,
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

interface TalentCardProps {
  contributor: TalentContributor;
}

const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";
const BG_CARD = "#ffffff";

export default function TalentCard({ contributor }: TalentCardProps) {
  const initials = contributor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        backgroundColor: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              backgroundColor: MINT_SOFT,
              border: `1px solid ${MINT_BDR}`,
              color: GREEN,
              fontSize: 13,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: CHARCOAL }}>{contributor.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED, fontFamily: "monospace" }}>{contributor.githubHandle}</p>
          </div>
        </div>
        {contributorStatus(contributor.status)}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          paddingTop: 12,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 12,
        }}
      >
        <div>
          <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Reputation Index</span>
          <span style={{ fontWeight: 700, color: GREEN, fontSize: 15 }}>{contributor.reputation} / 100</span>
        </div>
        <div>
          <span style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Verified PRs</span>
          <span style={{ fontWeight: 700, color: CHARCOAL, fontSize: 15 }}>{contributor.mergedPRs} merged</span>
        </div>
      </div>

      {/* Specialties */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {contributor.specialties.map((spec) => (
          <span
            key={spec}
            style={{
              fontSize: 11,
              color: MUTED,
              backgroundColor: "rgba(113,113,123,0.07)",
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            {spec}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <span style={{ fontSize: 11, color: MUTED }}>KYC Verified Contributor</span>
        <Link
          href="#"
          aria-disabled="true"
          title="Coming soon"
          style={{
            pointerEvents: "none",
            opacity: 0.5,
            padding: "6px 14px",
            borderRadius: 6,
            backgroundColor: "transparent",
            border: `1.5px solid ${BORDER}`,
            color: CHARCOAL,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
            textDecoration: "none",
          }}
        >
          Direct Assign →
        </Link>
      </div>
    </div>
  );
}