import AuthForm from "@/components/AuthForm";

export const metadata = {
  title: "Developer Login — GIG",
  description: "Sign in as a developer to discover tasks, contribute, and earn verified contributions.",
};

export default function DeveloperAuthPage() {
  return (
    <div className="section section-white" style={{ minHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      <div className="container" style={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 24, paddingBottom: 24 }}>
        <div style={{ width: "100%", maxWidth: 420, backgroundColor: "var(--color-pure-white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-fog-border)", padding: "32px", boxShadow: "var(--shadow-md)" }}>
          <h1 className="section-title" style={{ fontSize: 24, textAlign: "center", marginBottom: 4, letterSpacing: "-0.02em", color: "var(--color-deep-ink)", textTransform: "uppercase" }}>
            Developer Login
          </h1>
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-ash-mid)", marginBottom: 24 }}>
            Sign in to discover tasks, contribute, and build verified experience.
          </p>

          <AuthForm audience="developer" />

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <a
              href="/auth/business"
              style={{ fontSize: 13, color: "var(--color-ash-mid)", textDecoration: "none", fontWeight: 500 }}
            >
              I&apos;m a company →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
