"use client";
import { useState } from "react";

type Role = "Developer" | "Maintainer" | "Business";

export default function WaitlistForm() {
  const [role, setRole] = useState<Role>("Developer");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const validate = (v: string) => {
    const t = v.trim();
    if (!t) return "Please enter your email address to join the waitlist.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return "Please enter a valid email address (e.g. name@domain.com).";
    return "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = validate(email);
    if (msg) { setError(msg); return; }
    setError("");
    try {
      const key = "gig_waitlist_registrations";
      const raw = localStorage.getItem(key);
      const arr: Array<{ email: string; role: string; timestamp: string }> = raw ? JSON.parse(raw) : [];
      if (!arr.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) {
        arr.push({ email: email.trim(), role, timestamp: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch {}
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="waitlist-card">
        <div id="waitlist-success" className="success-message" role="status" aria-live="polite" style={{ display: "block" }}>
          <div className="success-icon-badge">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1a784d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 className="success-title">You&apos;re on the early access list!</h3>
          <p className="success-copy">
            Spot #2,849 reserved for <strong id="confirmed-email">{email}</strong> (<span id="confirmed-role">{role}</span> cohort). Keep an eye on your inbox — we&apos;ll send your access pass and repo onboarding guide shortly.
          </p>
          <div className="success-meta">✓ Cohort Spot #2,849 Confirmed · No Spam Ever</div>
          <button type="button" className="btn btn-secondary" id="reset-waitlist-btn" onClick={() => { setSuccess(false); setEmail(""); setError(""); }}>
            Register Another Email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="waitlist-card">
      <form id="waitlist-form" onSubmit={onSubmit} noValidate>
        <div className="role-selector-title">I WANT TO JOIN AS A:</div>
        <div className="role-selector" role="radiogroup" aria-label="Select your role">
          {(["Developer", "Maintainer", "Business"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`role-pill ${role === r ? "active" : ""}`}
              data-role={r}
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
            >
              {r === "Developer" ? "Developer / Contributor" : r === "Maintainer" ? "Open-Source Maintainer" : "Business / Task Creator"}
            </button>
          ))}
        </div>
        <div className="form-input-row">
          <input
            type="email"
            id="email-input"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your GitHub email (e.g. dev@braynix.com)"
            required
            autoComplete="email"
            aria-describedby="email-error"
            className={`waitlist-input ${error ? "has-error" : ""}`}
            aria-invalid={!!error}
          />
          <button type="submit" id="waitlist-submit" className="btn btn-primary waitlist-submit-btn">
            Request Early Access
          </button>
        </div>
        <div id="email-error" className={`error-message ${error ? "visible" : ""}`} role="alert" aria-live="polite">
          {error}
        </div>
        <div className="form-guarantee">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Cohort Spot #2,849 queue reservation · Zero spam · Unsubscribe anytime</span>
        </div>
      </form>
      {/* success hidden by default - rendered via state above when success=true */}
      <div id="waitlist-success" className="success-message" role="status" aria-live="polite" style={{ display: "none" }} />
    </div>
  );
}
