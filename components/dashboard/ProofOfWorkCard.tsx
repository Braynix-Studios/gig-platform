"use client";

import Link from "next/link";

const BORDER = "#e4e4e7";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";
const MINT = "#00c950";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const MINT_BDR = "rgba(0, 201, 80, 0.20)";
const GREEN = "#257b5a";
const CARD_SHADOW = "0 10px 28px rgba(37, 123, 90, 0.07)";
const BG_CARD = "#ffffff";

interface EvidenceRowProps {
  label: string;
  value: string;
  green?: boolean;
  icon: React.ReactNode;
}

function EvidenceRow({ icon, label, value, green = false }: EvidenceRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 0",
        fontSize: 13,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED }}>
        {icon}
        {label}
      </span>
      <span style={{ fontWeight: 600, color: green ? GREEN : CHARCOAL, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

interface ProofOfWorkCardProps {
  repo: string;
  prNumber: string;
  prUrl: string;
  title: string;
  subtitle: string;
  evidence: {
    label: string;
    value: string;
    green?: boolean;
    icon: React.ReactNode;
  }[];
  footer: {
    label: string;
    value: string;
    valueColor: string;
  }[];
}

export default function ProofOfWorkCard({ repo, prNumber, prUrl, title, subtitle, evidence, footer }: ProofOfWorkCardProps) {
  return (
    <div
      style={{
        backgroundColor: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: CARD_SHADOW,
      }}
    >
      {/* Card header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 24px",
          backgroundColor: "rgba(244, 244, 245, 0.40)",
          borderBottom: `1px solid ${BORDER}`,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={CHARCOAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
          <span>
            {repo} · Pull Request{' '}
            <Link href={prUrl} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, fontWeight: 700 }}>
              #{prNumber}
            </Link>
          </span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            borderRadius: 9999,
            backgroundColor: MINT_SOFT,
            border: `1px solid ${MINT_BDR}`,
            color: GREEN,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: MINT }} />
          MERGED & VERIFIED
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: 24 }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, lineHeight: 1.55, margin: 0, color: CHARCOAL }}>
          {title}
        </h3>
        <p style={{ marginTop: 6, fontSize: 13, color: MUTED, lineHeight: 1.4 }}>
          {subtitle}
        </p>

        {/* Evidence rows */}
        <div style={{ marginTop: 16, borderTop: `1px solid ${BORDER}` }}>
          {evidence.map((item, idx) => (
            <div key={item.label} style={{ borderTop: idx === 0 ? "none" : `1px solid ${BORDER}` }}>
              <EvidenceRow icon={item.icon} label={item.label} value={item.value} green={item.green} />
            </div>
          ))}
        </div>
      </div>

      {/* Dark charcoal footer strip — 3 columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          backgroundColor: CHARCOAL,
          textAlign: "center",
        }}
      >
        {footer.map((col, idx) => (
          <div
            key={col.label}
            style={{
              padding: "20px 24px",
              borderRight: idx < footer.length - 1 ? "1px solid rgba(255,255,255,0.10)" : "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.60)" }}>
              {col.label}
            </p>
            <p style={{ margin: 0, fontWeight: 700, color: col.valueColor }}>{col.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}