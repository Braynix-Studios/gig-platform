import React from "react";

// CSS-only loading skeletons matching GIG's design system:
// Emerald/mint (#257b5a, #00c950), charcoal (#151b1d), zinc border (#e4e4e7),
// card shadows (0 8px 24px rgba(37, 123, 90, 0.06)), and soft mint shimmer.
// Server-component friendly: zero JS, zero hydration cost.

export function Bar({
  width = "100%",
  height = 14,
  radius = 4,
  dark = false,
  style,
}: {
  width?: string | number;
  height?: number;
  radius?: number;
  dark?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={dark ? "skeleton-dark" : "skeleton"}
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** Hero header skeleton matching DevHeader / BizHeader dark console card */
export function HeroHeaderSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "#151b1d",
        border: "1.5px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        padding: "24px 28px",
        marginBottom: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bar width={120} height={18} radius={9999} dark />
          <Bar width={90} height={18} radius={9999} dark />
        </div>
        <Bar width={260} height={28} radius={6} dark />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              backgroundColor: "#00c950",
              opacity: 0.8,
              display: "inline-block",
            }}
          />
          <Bar width={180} height={12} radius={4} dark />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Bar width={130} height={42} radius={6} dark />
        <Bar width={110} height={42} radius={6} dark />
      </div>
    </div>
  );
}

/** 4-column metric cards skeleton matching GIG workspace telemetry */
export function StatsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading workspace metrics"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cards}, minmax(0, 1fr))`,
        gap: 16,
        marginBottom: 36,
      }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e4e4e7",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 8px 24px rgba(37, 123, 90, 0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <Bar width="50%" height={10} radius={3} />
            <div style={{ marginTop: 10 }}>
              <Bar width={i === 0 ? "40%" : "55%"} height={32} radius={6} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
            <Bar width="80%" height={11} radius={3} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Table skeleton matching TaskTable / Backlog rows */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading task backlog"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e4e4e7",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "0 8px 24px rgba(37, 123, 90, 0.06)",
        display: "grid",
        gap: 16,
      }}
    >
      {/* Table Section Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid #e4e4e7" }}>
        <div style={{ display: "grid", gap: 6 }}>
          <Bar width={180} height={18} radius={4} />
          <Bar width={260} height={12} radius={3} />
        </div>
        <Bar width={120} height={34} radius={6} />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "12px 0",
            borderBottom: i === rows - 1 ? "none" : "1px solid #f4f4f5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
            <Bar width={36} height={36} radius={8} />
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              <Bar width={`${75 - (i % 3) * 10}%`} height={15} radius={4} />
              <div style={{ display: "flex", gap: 8 }}>
                <Bar width={100} height={12} radius={3} />
                <Bar width={70} height={12} radius={3} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Bar width={80} height={24} radius={9999} />
            <Bar width={90} height={34} radius={6} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card Skeleton for form/standalone widgets */
export function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading content"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e4e4e7",
        borderRadius: 12,
        padding: 28,
        boxShadow: "0 8px 24px rgba(37, 123, 90, 0.06)",
        display: "grid",
        gap: 16,
        maxWidth: 440,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Bar width={44} height={44} radius={8} />
        <div style={{ flex: 1, display: "grid", gap: 6 }}>
          <Bar width="60%" height={16} radius={4} />
          <Bar width="40%" height={12} radius={3} />
        </div>
      </div>
      <Bar width="100%" height={40} radius={6} />
      <Bar width="100%" height={40} radius={6} />
      <Bar width="100%" height={42} radius={6} />
    </div>
  );
}

export function FormSkeleton() {
  return <CardSkeleton />;
}

/** Dashboard Page Content Skeleton (used inside DashboardLayout to avoid duplicate sidebars) */
export function DashboardPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard content"
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 36px 80px",
        backgroundColor: "#fbfcfb",
        minHeight: "100%",
      }}
    >
      <HeroHeaderSkeleton />
      <StatsSkeleton />
      <TableSkeleton rows={4} />
    </div>
  );
}

/** Full Dashboard Shell Skeleton: matching GIG's branded sidebar + main page skeleton */
export function DashboardShellSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      style={{
        display: "flex",
        minHeight: "100dvh",
        backgroundColor: "#fbfcfb",
      }}
    >
      {/* GIG Sidebar Skeleton */}
      <div
        aria-hidden="true"
        style={{
          width: 248,
          flexShrink: 0,
          backgroundColor: "#f6f8f7",
          borderRight: "1px solid #e4e4e7",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid #e4e4e7" }}>
          <span style={{ color: "#00c950", fontSize: "1.875rem", fontWeight: 900, letterSpacing: "-0.08em", lineHeight: 1 }}>gig</span>
          <Bar width={70} height={18} radius={9999} />
        </div>

        {/* User Card */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <Bar width={40} height={40} radius={4} />
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <Bar width="70%" height={14} radius={3} />
            <Bar width="50%" height={11} radius={3} />
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <Bar width={60} height={10} radius={3} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} width="100%" height={36} radius={4} />
          ))}
          <div style={{ marginTop: 12 }}>
            <Bar width={60} height={10} radius={3} />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <Bar key={i} width="100%" height={36} radius={4} />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <DashboardPageSkeleton />
      </div>
    </div>
  );
}

/** Branded full-page loading screen matching GIG platform aesthetic */
export function BrandLoadingScreen({ message = "Synchronizing Secure Workspace..." }: { message?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading GIG Platform"
      style={{
        minHeight: "70dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            color: "#00c950",
            fontSize: "2.75rem",
            fontWeight: 900,
            letterSpacing: "-0.08em",
            lineHeight: 1,
          }}
        >
          gig
        </span>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            backgroundColor: "#00c950",
            boxShadow: "0 0 12px #00c950",
            display: "inline-block",
          }}
        />
      </div>

      {/* Shimmer progress bar */}
      <div
        style={{
          width: 180,
          height: 3,
          backgroundColor: "#e4e4e7",
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          className="skeleton"
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#257b5a",
          }}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#71717b",
          marginTop: 4,
        }}
      >
        {message}
      </span>
    </div>
  );
}
