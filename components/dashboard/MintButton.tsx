"use client";

import Link from "next/link";

const MINT = "#00c950";
const MINT_FG = "#f0fdf4";

interface MintButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function MintButton({ href, children }: MintButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center"
      style={{
        height: 40,
        padding: "0 18px",
        borderRadius: 6,
        backgroundColor: MINT,
        color: MINT_FG,
        fontWeight: 700,
        fontSize: 13,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}