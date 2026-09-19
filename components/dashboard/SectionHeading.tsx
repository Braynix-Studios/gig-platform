"use client";

const CHARCOAL = "#151b1d";
const MUTED = "#71717b";

interface SectionHeadingProps {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}

export default function SectionHeading({ title, sub, right }: SectionHeadingProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "1.125rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: CHARCOAL,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}