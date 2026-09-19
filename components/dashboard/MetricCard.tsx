"use client";

const BG_CARD = "#ffffff";
const BORDER = "#e4e4e7";
const CHARCOAL = "#151b1d";
const MUTED = "#71717b";
const MINT_SOFT = "rgba(0, 201, 80, 0.10)";
const GREEN = "#257b5a";
const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";

interface MetricCardProps {
  label: string;
  value: string;
  footer: string;
  badge?: string;
  green?: boolean;
  anchorId?: string;
}

export default function MetricCard({
  label,
  value,
  footer,
  badge,
  green = false,
  anchorId,
}: MetricCardProps) {
  return (
    <div
      id={anchorId}
      style={{
        backgroundColor: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: CARD_SHADOW,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        scrollMarginTop: 24,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              color: MUTED,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
          {badge && (
            <span
              style={{
                backgroundColor: MINT_SOFT,
                color: GREEN,
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 9999,
                padding: "3px 8px",
                whiteSpace: "nowrap",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: "2.25rem",
            fontWeight: 900,
            lineHeight: 1.11,
            letterSpacing: "-0.04em",
            color: green ? GREEN : CHARCOAL,
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          borderTop: `1px solid ${BORDER}`,
          paddingTop: 12,
          color: MUTED,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {footer}
      </div>
    </div>
  );
}