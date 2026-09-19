"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

const CENTER_LINKS = [
  { href: "/#products", label: "Products" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/#resources", label: "Resources" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#data", label: "Human Data" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/dashboard")) {
    return null;
  }

  const onAuth = pathname === "/auth";

  return (
    <header className="navbar" id="navbar">
      <div className="container nav-container">
        <Link href="/" className="nav-brand" aria-label="GIG Home">
          <Image
            src="/gig-logo.png"
            alt="GIG — Get In Git"
            width={75}
            height={50}
            className="brand-logo"
            priority
          />
        </Link>

        <ul className="nav-links">
          {CENTER_LINKS.map((l) => (
            <li key={l.label}>
              <Link href={l.href} className="nav-link">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <Link
            href="/auth"
            className={`btn btn-nav-outline${onAuth ? " is-active" : ""}`}
            aria-current={onAuth ? "page" : undefined}
          >
            Log In
          </Link>
          <Link href="/#waitlist" className="btn btn-nav">
            Request Demo
          </Link>
          <button
            className="mobile-menu-btn"
            id="mobile-menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <nav
        className={`mobile-menu${open ? " open" : ""}`}
        id="mobile-nav-drawer"
        aria-label="Mobile Navigation"
      >
        {CENTER_LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            onClick={() => setOpen(false)}
            className="nav-link mobile-link"
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/auth"
          onClick={() => setOpen(false)}
          className="nav-link mobile-link"
        >
          Log In
        </Link>
        <Link
          href="/#waitlist"
          onClick={() => setOpen(false)}
          className="btn btn-primary mobile-link"
          style={{ textAlign: "center", marginTop: 8 }}
        >
          Request Demo
        </Link>
      </nav>
    </header>
  );
}
