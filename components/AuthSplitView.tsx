import Link from "next/link";
import { AUTH_ERROR_MESSAGES } from "@/components/AuthForm";

export default function AuthSplitView({ error }: { error?: string }) {
  const oauthMessage = error ? AUTH_ERROR_MESSAGES[error] || "Authentication failed. Please try again." : null;

  return (
    <div className="section section-white" style={{ minHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column", padding: 0 }}>
      {/* Large empty/airy transition area provided by flex-grow */}
      <div className="container" style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 40, paddingBottom: 40 }}>

        {oauthMessage && (
          <div style={{ width: "100%", maxWidth: 1000, margin: "0 auto 16px" }}>
            <p className="error-message visible" role="alert" style={{ display: "block" }}>
              {oauthMessage}
            </p>
          </div>
        )}

        {/* Two-column authentication choice section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", maxWidth: 1000, margin: "0 auto" }}>

          {/* For Companies Panel */}
          <div style={{ padding: "32px 48px", borderRight: "1px solid var(--color-fog-border)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ marginBottom: 16, padding: "10px", borderRadius: "var(--radius-md)", backgroundColor: "#f2f5f6" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <line x1="2" y1="10" x2="22" y2="10"></line>
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--color-deep-ink)", marginBottom: 12 }}>
              For <span style={{ color: "var(--color-skill-green)" }}>Companies</span>
            </h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-ash-mid)", marginBottom: 32, maxWidth: 300, lineHeight: 1.5 }}>
              Publish work, find contributors, evaluate engineering ability, and access verified talent.
            </p>
            <Link
              href="/auth/business"
              className="btn btn-primary"
              style={{ width: "100%", maxWidth: 260, marginBottom: 16, padding: "12px 24px", fontSize: 14, textDecoration: "none" }}
            >
              Continue as Business
            </Link>
            <div style={{ fontSize: 13, color: "var(--color-ash-mid)" }}>
              Don&apos;t have a business account?<br />
              <Link href="/#waitlist" style={{ color: "var(--color-skill-green)", fontWeight: 600, marginTop: 8, display: "inline-block", transition: "opacity 0.2s" }}>
                Create business account
              </Link>
            </div>
          </div>

          {/* For Developers Panel */}
          <div style={{ padding: "32px 48px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ marginBottom: 16, padding: "10px", borderRadius: "var(--radius-md)", backgroundColor: "#f2f5f6" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-deep-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--color-deep-ink)", marginBottom: 12 }}>
              For <span style={{ color: "var(--color-creator-violet)" }}>Developers</span>
            </h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-ash-mid)", marginBottom: 32, maxWidth: 300, lineHeight: 1.5 }}>
              Discover tasks, contribute, build verified experience, earn reputation, and progress through contribution levels.
            </p>
            <Link
              href="/auth/developer"
              className="btn btn-secondary"
              style={{ width: "100%", maxWidth: 260, marginBottom: 16, padding: "12px 24px", fontSize: 14, textDecoration: "none", backgroundColor: "var(--color-deep-ink)", color: "var(--color-pure-white)", border: "none" }}
            >
              Continue with GitHub
            </Link>
            <div style={{ fontSize: 13, color: "var(--color-ash-mid)" }}>
              Don&apos;t have a GIG account?<br />
              <Link href="/#waitlist" style={{ color: "var(--color-skill-green)", fontWeight: 600, marginTop: 8, display: "inline-block", transition: "opacity 0.2s" }}>
                Create developer profile
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
