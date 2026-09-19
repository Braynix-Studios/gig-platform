// CSS-only loading skeletons (server component: zero JS, zero hydration cost).
// Shown during route transitions via loading.tsx and inside <Suspense>.

function Bar({
  width = "100%",
  height = 14,
  radius = 4,
}: {
  width?: string | number;
  height?: number;
  radius?: number;
}) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function StatsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading statistics"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: "var(--color-pure-white)",
            border: "1px solid var(--color-fog-border)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
            display: "grid",
            gap: 10,
          }}
        >
          <Bar width="45%" height={12} />
          <Bar width="70%" height={26} radius={6} />
          <Bar width="90%" height={12} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading list"
      style={{
        backgroundColor: "var(--color-pure-white)",
        border: "1px solid var(--color-fog-border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <Bar width="30%" height={16} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Bar width={36} height={36} radius={18} />
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <Bar width={`${85 - (i % 3) * 12}%`} height={13} />
            <Bar width="40%" height={11} />
          </div>
          <Bar width={72} height={28} radius={4} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading content"
      style={{
        backgroundColor: "var(--color-pure-white)",
        border: "1px solid var(--color-fog-border)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        display: "grid",
        gap: 12,
        maxWidth: 420,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <Bar width="55%" height={22} />
      <Bar width="85%" height={13} />
      <Bar width="100%" height={44} radius={4} />
      <Bar width="100%" height={13} />
      <Bar width="100%" height={44} radius={4} />
    </div>
  );
}

export function FormSkeleton() {
  return <CardSkeleton />;
}

/** Full dashboard shell: sidebar + header + content placeholders. */
export function DashboardShellSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" style={{ display: "flex", minHeight: "100dvh" }}>
      <div
        aria-hidden="true"
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid var(--color-fog-border)",
          padding: 20,
          display: "grid",
          gap: 12,
          alignContent: "start",
        }}
      >
        <Bar width="60%" height={22} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} width={`${90 - (i % 2) * 15}%`} height={32} radius={6} />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: 24, display: "grid", gap: 20, alignContent: "start" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Bar width="28%" height={26} />
          <Bar width="45%" height={14} />
        </div>
        <StatsSkeleton />
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}
