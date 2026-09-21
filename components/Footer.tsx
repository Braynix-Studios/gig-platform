import Link from "next/link";

export default function Footer() {
  return (
    <footer id="footer" className="footer section-black">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand-col">
            <Link href="/" className="nav-brand" aria-label="GIG Home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gig-logo.png" alt="GIG — Get In Git" className="footer-brand-logo" width={75} height={50} />
            </Link>
            <p className="footer-slogan">&quot;Stop building fake projects. Start shipping real software.&quot;</p>
            <div className="footer-studio-tag">
              A Product by{" "}
              <a href="https://braynix.netlify.app/" className="social-link" target="_blank" rel="noopener noreferrer">
                Braynix Studios
              </a>
            </div>
          </div>
          <div>
            <h4 className="footer-col-title">PRODUCT</h4>
            <ul className="footer-links">
              <li>
                <Link href="/#how-it-works" className="footer-link">
                  Task Discovery Feed
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="footer-link">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#features" className="footer-link">
                  Evidence Profiles
                </Link>
              </li>
              <li>
                <Link href="/#features" className="footer-link">
                  Reputation Engine (0–100)
                </Link>
              </li>
              <li>
                <Link href="/#features" className="footer-link">
                  GIG Wallet &amp; Economics
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">ECOSYSTEM</h4>
            <ul className="footer-links">
              <li>
                <Link href="/#waitlist" className="footer-link">
                  For OS Maintainers
                </Link>
              </li>
              <li>
                <Link href="/#waitlist" className="footer-link">
                  For Business Creators
                </Link>
              </li>
              <li>
                <Link href="/#features" className="footer-link">
                  Task Specification Standard
                </Link>
              </li>
              <li>
                <Link href="/#features" className="footer-link">
                  GitHub App Integration
                </Link>
              </li>
              <li>
                <Link href="/#features" className="footer-link">
                  Contribution Tiers
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">BRAYNIX STUDIOS</h4>
            <ul className="footer-links">
              <li>
                <a href="#" className="footer-link">
                  About Braynix Studios
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Product Vision &amp; Roadmap
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Engineering Blog
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Open Source Commitments
                </a>
              </li>
              <li>
                <Link href="/#waitlist" className="footer-link">
                  Contact Team
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="footer-col-title">TRUST &amp; LEGAL</h4>
            <ul className="footer-links">
              <li>
                <a href="#" className="footer-link">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Contributor Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Blockchain Audit Policy
                </a>
              </li>
              <li>
                <a href="#" className="footer-link">
                  Security &amp; Sandboxing
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p className="footer-legal-disclaimer">
            GIG records and verifies eligible payment events through an immutable cryptographic audit ledger. GIG is an independent engineering platform developed by
            Braynix Studios (Product Lead: Pranjal Yadav) and is not affiliated with, endorsed by, or sponsored by GitHub, Inc.
          </p>
          <div className="footer-meta-row">
            <div>© 2026 Braynix Studios. All rights reserved.</div>
            <div className="footer-social-links">
              <a href="https://github.com/Braynix-Studios" className="social-link" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://x.com/braynixStudios" className="social-link" target="_blank" rel="noopener noreferrer">
                X / Twitter
              </a>
              <a href="https://www.instagram.com/braynix_studios/" className="social-link" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
              <a href="https://www.linkedin.com/company/braynix-studios/" className="social-link" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
