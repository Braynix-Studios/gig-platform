import WaitlistForm from "@/components/WaitlistForm";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main>
        {/* Hero - Mode White - Exact copy of gig_launch_page/index.html */}
        <section id="hero" className="section section-white">
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <div className="hero-pill-wrap">
                  <span className="pill-badge pill-badge-light">BETA COHORT · PRIVATE WAITLIST OPEN</span>
                </div>
                <h1 className="poster-headline hero-title">
                  STOP BUILDING
                  <br />
                  TUTORIAL TOY APPS.
                  <br />
                  SHIP REAL SOFTWARE.
                </h1>
                <p className="hero-lead">
                  Break out of tutorial purgatory. GIG connects ambitious developers with curated open-source and business engineering backlogs. Fix
                  production bugs, pass maintainer code review, earn wallet bounties, and build an undeniable, evidence-backed engineering record — not a
                  self-declared résumé.
                </p>
                <div className="hero-actions">
                  <a href="#waitlist" className="btn btn-primary">
                    Claim Early Access
                  </a>
                  <a href="#how-it-works" className="btn btn-secondary">
                    Explore Task Flow
                  </a>
                </div>
                <div className="hero-proof">
                  <div className="proof-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Backed by Real GitHub PRs</span>
                  </div>
                  <div className="proof-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Zero Fake Certificates</span>
                  </div>
                  <div className="proof-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Direct UPI Disbursals</span>
                  </div>
                </div>
              </div>

              <div className="hero-visual">
                <div className="hero-card">
                  <div className="hero-card-header">
                    <div className="card-header-left">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0b1215" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                        <path d="M9 18c-4.51 2-5-2-7-2"></path>
                      </svg>
                      <span>
                        vercel/next.js · Issue{" "}
                        <a href="https://github.com/vercel/next.js/pull/98006" style={{ color: "#1a784d" }} target="_blank" rel="noopener noreferrer">
                          #98006
                        </a>
                      </span>
                    </div>
                    <div className="status-badge-merged">
                      <span className="status-dot"></span>
                      <span>MERGED & VERIFIED</span>
                    </div>
                  </div>
                  <div className="hero-card-body">
                    <h3 className="issue-title">Fix stale redirect marker in hidden Activity causing hard navigation</h3>
                    <p className="issue-meta">Tier 2 Verified Task · TypeScript / Next.js / PostgreSQL</p>
                    <div className="provenance-flow">
                      <div className="prov-row">
                        <span className="prov-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 14 14"></polyline>
                          </svg>
                          Merge Latency
                        </span>
                        <span className="prov-val">4Days from Claim to Review</span>
                      </div>
                      <div className="prov-row">
                        <span className="prov-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                          </svg>
                          Code Diff
                        </span>
                        <span className="prov-val" style={{ color: "#1a784d" }}>
                          +352 lines · -3 lines · 107 unit tests
                        </span>
                      </div>
                      <div className="prov-row">
                        <span className="prov-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          Maintainer Review
                        </span>
                        <span className="prov-val">
                          Approved by{" "}
                          <a href="https://github.com/eps1lon" target="_blank" rel="noopener noreferrer" style={{ color: "#1a784d" }}>
                            @eps1lon
                          </a>{" "}
                          (Core Team)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer-metrics">
                    <div>
                      <div className="metric-box-title">REPUTATION</div>
                      <div className="metric-box-num">+4 pts</div>
                    </div>
                    <div>
                      <div className="metric-box-title">SPECIALIZATION</div>
                      <div className="metric-box-num" style={{ color: "var(--color-pure-white)" }}>
                        Next.js L2
                      </div>
                    </div>
                    <div>
                      <div className="metric-box-title">BOUNTY EARNED</div>
                      <div className="metric-box-num">₹500</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Mode Black - Exact copy */}
        <section id="how-it-works" className="section section-black">
          <div className="container">
            <span className="overline">THE DEVELOPER JOURNEY</span>
            <h2 className="section-title">FROM FIRST ISSUE TO VERIFIED RECORD</h2>
            <p className="section-subtitle">No simulations. No toy problems. A structured four-step pipeline that transforms raw code commits into portable career proof.</p>
            <div className="steps-grid">
              <div className="step-card">
                <div className="step-badge-row">
                  <span className="step-num">STEP 01 / DISCOVERY</span>
                  <div className="step-icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </div>
                </div>
                <h3 className="step-title">Find &amp; Lock Scoped Tasks</h3>
                <p className="step-desc">Browse curated engineering issues across opted-in open-source repos and business backlogs. Filter by stack (React, Node.js, Python, TypeScript) and difficulty tier. Claim an issue to lock it exclusively for 48 hours — no squatting, no bidding wars.</p>
                <div className="step-detail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Single active claim per task</span>
                </div>
              </div>
              <div className="step-card">
                <div className="step-badge-row">
                  <span className="step-num">STEP 02 / IMPLEMENTATION</span>
                  <div className="step-icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15"></line>
                      <circle cx="18" cy="6" r="3"></circle>
                      <circle cx="6" cy="18" r="3"></circle>
                      <path d="M18 9a9 9 0 0 1-9 9"></path>
                    </svg>
                  </div>
                </div>
                <h3 className="step-title">Clone, Reproduce &amp; Engineer</h3>
                <p className="step-desc">Step into an existing production repository. Read architectural patterns, reproduce the bug locally, write clean regression tests, and adhere to strict contribution guidelines. Submit your pull request directly via GitHub with transparent AI-assistance disclosure.</p>
                <div className="step-detail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Real Git workflows &amp; guidelines</span>
                </div>
              </div>
              <div className="step-card">
                <div className="step-badge-row">
                  <span className="step-num">STEP 03 / VERIFICATION</span>
                  <div className="step-icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                </div>
                <h3 className="step-title">Survive Maintainer Review</h3>
                <p className="step-desc">Your pull request is reviewed by genuine repository maintainers and lead engineers. Address review feedback, refine edge cases, pass automated CI build suites, and merge your solution into main branch.</p>
                <div className="step-detail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Production maintainer sign-off</span>
                </div>
              </div>
              <div className="step-card">
                <div className="step-badge-row">
                  <span className="step-num">STEP 04 / PAYOUT &amp; PROOF</span>
                  <div className="step-icon-wrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                </div>
                <h3 className="step-title">Unlock Wallet Payouts &amp; Evidence</h3>
                <p className="step-desc">The merged PR automatically creates a permanent Verified Contribution on your public profile, recalculates your 0–100 Reputation Score, and credits your GIG Wallet. Once your balance hits ₹500, withdraw directly to your bank via UPI.</p>
                <div className="step-detail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Instant UPI &amp; audit proof</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features - Mode White - Exact copy */}
        <section id="features" className="section section-white">
          <div className="container">
            <span className="overline">PLATFORM PILLARS</span>
            <h2 className="section-title">AN ENGINEERING RECORD, NOT A RÉSUMÉ</h2>
            <p className="section-subtitle">Five deeply integrated systems designed to replace self-reported claims with inspectable, proof-of-work engineering data.</p>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </div>
                <h3 className="feature-title">Inspectable Evidence Layer</h3>
                <p className="feature-desc">Instead of an unverifiable &quot;React Expert&quot; badge, your GIG profile displays the exact sequence of shipped work: 12 verified contributions, 6 merged PRs, and 3 maintainer approvals. Every single claim is clickable, drilling down from Profile → Task → Repo → PR → Code Diff → Reviewer Approval.</p>
                <div className="feature-proof-tag">
                  <span>Clickable drill-down: Profile → PR → Diff → Sign-off</span>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="m4.93 4.93 4.24 4.24"></path>
                    <path d="m14.83 9.17 4.24-4.24"></path>
                    <path d="m14.83 14.83 4.24 4.24"></path>
                    <path d="m9.17 14.83-4.24 4.24"></path>
                  </svg>
                </div>
                <h3 className="feature-title">Transparent 0–100 Reputation Engine</h3>
                <p className="feature-desc">No arbitrary karma numbers or gamified badges. Reputation is scored on a clear 0–100 scale derived from five weighted sub-scores: Contribution Quality (30), Reliability (25), Code Quality (20), Review Performance (15), and Open Source Engagement (10). Transparent and inspectable.</p>
                <div className="feature-proof-tag">
                  <span>0–100 weighted scale with public sub-score breakdown</span>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                  </svg>
                </div>
                <h3 className="feature-title">GIG Wallet &amp; Real Rewards</h3>
                <p className="feature-desc">Turn verified contributions into real earnings. Tasks are priced across balanced economic tiers: Micro (₹25–₹50), Small (₹50–₹250), Intermediate (₹250–₹1,000), and Advanced (₹1,000+). Earnings transition through strict states: Pending → Verified → Available → Redeemed.</p>
                <div className="feature-proof-tag">
                  <span>₹500 threshold · Automated UPI withdrawal to bank</span>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <polyline points="16 11 18 13 22 9"></polyline>
                  </svg>
                </div>
                <h3 className="feature-title">Contribution Tiers &amp; Trust Ladder</h3>
                <p className="feature-desc">A progression ladder that gates high-consequence work behind demonstrated reliability: Tier 1 (Explore: open to all beginners), Tier 2 (GIG Verified: unlocks paid open-source tasks), and Tier 3 (Business Contributor: unlocks private repos and production business bugs).</p>
                <div className="feature-proof-tag">
                  <span>Tier 1 (Explore) → Tier 2 (Verified) → Tier 3 (Business)</span>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                </div>
                <h3 className="feature-title">Secure Audit Ledger</h3>
                <p className="feature-desc">GIG records and verifies eligible payment events through a tamper-evident audit ledger. Every payout generates a permanent GIG Payment Proof containing the withdrawal ID, ledger reference, and timestamp. All personal identifiers remain protected for total privacy.</p>
                <div className="feature-proof-tag">
                  <span>Zero PII exposed · Verifiable receipt</span>
                </div>
              </div>
              <div className="feature-card">
                <div className="feature-icon-wrap">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"></path>
                    <path d="M18 14v5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-5"></path>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                  </svg>
                </div>
                <h3 className="feature-title">AI Issue Assistant &amp; Authenticity</h3>
                <p className="feature-desc">GIG embraces AI as a mentor rather than a shortcut. Our AI Issue Assistant analyzes repository architecture, points out relevant files, and suggests debugging hypotheses without generating copy-paste code. Every submission requires an AI-assistance disclosure.</p>
                <div className="feature-proof-tag">
                  <span>Transparent AI usage disclosure on all PR submissions</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats - Mode Black - Exact copy */}
        <section id="stats" className="section section-black">
          <div className="container">
            <span className="overline">MARKETPLACE MOMENTUM</span>
            <h2 className="section-title">REAL WORK. REAL REPOSITORIES. REAL IMPACT.</h2>
            <p className="section-subtitle">Built for developers tired of toy apps, and maintainers seeking reliable, vetted contributors.</p>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-val">500+</div>
                <div className="stat-label">CURATED TASKS AVAILABLE</div>
                <p className="stat-sub">From beginner UI fixes to intermediate distributed backend optimizations.</p>
              </div>
              <div className="stat-card">
                <div className="stat-val">3,400+</div>
                <div className="stat-label">VERIFIED PR MERGES</div>
                <p className="stat-sub">Merged by genuine maintainers into production main branches.</p>
              </div>
              <div className="stat-card">
                <div className="stat-val">120+</div>
                <div className="stat-label">OPTED-IN REPOSITORIES</div>
                <p className="stat-sub">Active open-source projects with automated GIG discovery.</p>
              </div>
              <div className="stat-card">
                <div className="stat-val">₹12.5L+</div>
                <div className="stat-label">VERIFIED EARNINGS DISBURSED</div>
                <p className="stat-sub">Paid directly to developer bank accounts via instant UPI.</p>
              </div>
            </div>
            <div className="quotes-grid">
              <div className="quote-card">
                <p className="quote-text">&quot;GIG eliminated the spam PRs we used to get during hackathons. Contributors arrive having read our guidelines, reproduce the issue locally, and submit clean, well-tested code.&quot;</p>
                <div className="quote-author">
                  <span className="author-name">Arpit K.</span>
                  <span className="author-role">Open Source Maintainer &amp; Core Contributor</span>
                </div>
              </div>
              <div className="quote-card">
                <p className="quote-text">&quot;I spent 6 months building to-do clones that no recruiter ever opened. After solving three real issues on GIG, I had maintainer-approved PRs to show during my technical interviews. That got me hired.&quot;</p>
                <div className="quote-author">
                  <span className="author-name">Rithvik M.</span>
                  <span className="author-role">Early-Career Software Engineer</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Waitlist - Mode White - Exact copy (form via client component) */}
        <section id="waitlist" className="section section-white">
          <div className="container">
            <div className="waitlist-wrapper">
              <span className="overline">EARLY ACCESS COHORT</span>
              <h2 className="section-title">BE THE FIRST TO SHIP REAL CODE</h2>
              <p className="section-subtitle" style={{ marginLeft: "auto", marginRight: "auto" }}>
                We are rolling out invite-only access in weekly cohorts. Reserve your handle, connect your GitHub, and get notified when tasks go live in your
                tech stack.
              </p>
              <WaitlistForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
