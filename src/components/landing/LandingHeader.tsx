"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useCurrentRole } from "@/components/ui/RoleContext";

interface NavLinkItem {
  href: string;
  label: string;
}

const NAV_LINKS: readonly NavLinkItem[] = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader(): ReactNode {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, currentRole } = useCurrentRole();

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <header className={`landing-header ${isScrolled ? "is-scrolled" : ""}`} role="banner">
      <div className="landing-header-container">
        {/* Brand logo */}
        <Link
          href="/"
          className="landing-brand-link"
          aria-label="FieldTrack Home"
          onClick={closeMenu}
        >
          <div className="landing-brand-icon" aria-hidden="true">
            F
          </div>
          <span className="landing-brand-name">FieldTrack</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="landing-desktop-nav" aria-label="Main product navigation">
          <ul className="landing-nav-list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="landing-nav-link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop Auth Actions */}
        <div className="landing-actions">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="btn btn-primary landing-cta-btn"
              title={`Logged in as ${currentRole}`}
            >
              <span>Go to Dashboard</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="landing-signin-link">
                Sign In
              </Link>
              <Link href="/signup" className="btn btn-primary landing-cta-btn">
                <span>Get Started</span>
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="landing-mobile-toggle"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="mobile-navigation-drawer"
        >
          {mobileMenuOpen ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Backdrop & Drawer */}
      <div
        className={`landing-mobile-backdrop ${mobileMenuOpen ? "is-open" : ""}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <div
        id="mobile-navigation-drawer"
        className={`landing-mobile-drawer ${mobileMenuOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        <div className="landing-drawer-header">
          <Link href="/" className="landing-brand-link" onClick={closeMenu}>
            <div className="landing-brand-icon" aria-hidden="true">
              F
            </div>
            <span className="landing-brand-name">FieldTrack</span>
          </Link>
          <button
            type="button"
            className="landing-drawer-close"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="landing-drawer-nav" aria-label="Mobile product links">
          <ul className="landing-drawer-list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="landing-drawer-link" onClick={closeMenu}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="landing-drawer-footer">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={closeMenu}
            >
              Go to Dashboard →
            </Link>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                width: "100%",
              }}
            >
              <Link
                href="/signup"
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={closeMenu}
              >
                Get Started →
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={closeMenu}
              >
                Sign In to Workspace
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
