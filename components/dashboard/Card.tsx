"use client";

const BG_CARD = "#ffffff";
const BORDER = "#e4e4e7";
const CARD_SHADOW = "0 8px 24px rgba(37, 123, 90, 0.06)";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export default function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: BG_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}