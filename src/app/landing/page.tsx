import Link from "next/link";
import type { ReactNode } from "react";

export default function LandingPage(): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3.5rem",
        paddingBottom: "2rem",
      }}
    >
      {/* Hero Section */}
      <section
        aria-labelledby="hero-heading"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #F4F6FB 100%)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          padding: "3.5rem 2rem",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          boxShadow: "var(--shadow-sm)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.375rem 0.875rem",
            borderRadius: "var(--radius-full)",
            background: "var(--status-info-bg)",
            border: "1px solid var(--status-info-border)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--brand-primary)",
          }}
        >
          <span style={{ fontSize: "0.75rem" }}>●</span>
          <span>Enterprise Field Operations & Travel Tracking SaaS</span>
        </div>

        <h1
          id="hero-heading"
          style={{
            fontSize: "clamp(2rem, 4vw, 3.25rem)",
            lineHeight: 1.15,
            margin: 0,
            maxWidth: "54rem",
            color: "var(--brand-dark)",
          }}
        >
          Complete Operational Visibility for Retail & FMCG Field Teams
        </h1>

        <p
          style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            maxWidth: "42rem",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Plan multi-store routes, enforce manager approvals, capture verifiable visit
          evidence, and monitor field execution in real time across your distributed
          organization.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "0.5rem",
          }}
        >
          <Link
            href="/"
            className="btn btn-primary"
            style={{ padding: "0.75rem 1.75rem", fontSize: "1rem" }}
          >
            <span>Explore Live Dashboard</span>
            <span>→</span>
          </Link>
          <Link
            href="/trips"
            className="btn btn-secondary"
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem" }}
          >
            View Trip Management
          </Link>
          <Link
            href="/login"
            className="btn btn-outline"
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem" }}
          >
            Sign In to Workspace
          </Link>
        </div>

        {/* Realistic Interactive Product Preview / Dashboard Composition */}
        <div
          style={{
            marginTop: "2rem",
            width: "100%",
            maxWidth: "64rem",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-xl)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border-default)",
              paddingBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "0.75rem",
                  height: "0.75rem",
                  borderRadius: "50%",
                  background: "#EF4444",
                }}
              ></div>
              <div
                style={{
                  width: "0.75rem",
                  height: "0.75rem",
                  borderRadius: "50%",
                  background: "#F59E0B",
                }}
              ></div>
              <div
                style={{
                  width: "0.75rem",
                  height: "0.75rem",
                  borderRadius: "50%",
                  background: "#10B981",
                }}
              ></div>
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-muted)",
                  marginLeft: "0.5rem",
                  fontWeight: 600,
                }}
              >
                FieldTrack Operations Control • Enterprise Operations Preview
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                background: "var(--status-success-bg)",
                color: "var(--status-success-text)",
                padding: "0.125rem 0.5rem",
                borderRadius: "var(--radius-full)",
                fontWeight: 600,
              }}
            >
              Live Telemetry Active
            </span>
          </div>

          <div className="card-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div
              style={{
                background: "#FAFCFE",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span className="card-meta">ACTIVE FIELD TRIPS</span>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0.25rem 0 0",
                  color: "var(--brand-dark)",
                }}
              >
                4
              </p>
              <span style={{ fontSize: "0.75rem", color: "var(--status-success)" }}>
                ↑ 12% vs last week
              </span>
            </div>
            <div
              style={{
                background: "#FAFCFE",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span className="card-meta">AWAITING APPROVAL</span>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0.25rem 0 0",
                  color: "var(--brand-accent)",
                }}
              >
                3
              </p>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Requires manager review
              </span>
            </div>
            <div
              style={{
                background: "#FAFCFE",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span className="card-meta">COMPLETED VISITS</span>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0.25rem 0 0",
                  color: "var(--status-success)",
                }}
              >
                38
              </p>
              <span style={{ fontSize: "0.75rem", color: "var(--status-success)" }}>
                94.2% on-time rate
              </span>
            </div>
            <div
              style={{
                background: "#FAFCFE",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span className="card-meta">FLAGGED EXCEPTIONS</span>
              <p
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: "0.25rem 0 0",
                  color: "var(--status-danger)",
                }}
              >
                2
              </p>
              <span style={{ fontSize: "0.75rem", color: "var(--status-danger)" }}>
                Cooler & stockout alerts
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Core Feature Pillars */}
      <section
        aria-labelledby="features-heading"
        style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
      >
        <div style={{ textAlign: "center", maxWidth: "42rem", margin: "0 auto" }}>
          <h2 id="features-heading" style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>
            Engineered for Distributed Field Operations
          </h2>
          <p className="card-meta" style={{ fontSize: "1rem" }}>
            From route creation to managerial sign-off, FieldTrack connects every phase of
            field travel.
          </p>
        </div>

        <div
          className="card-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}
        >
          <div className="card">
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "var(--radius-md)",
                background: "var(--status-info-bg)",
                color: "var(--brand-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              🗺️
            </div>
            <h3 className="card-title" style={{ fontSize: "1.125rem" }}>
              Multi-Stop Trip Planning
            </h3>
            <p className="card-meta" style={{ lineHeight: 1.5 }}>
              Sequence multi-store itineraries, assign territory representatives, define
              expected merchandising outcomes, and estimate travel allowances with
              complete route visibility.
            </p>
            <Link
              href="/trips/new"
              style={{
                fontSize: "0.875rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Explore Trip Creator →
            </Link>
          </div>

          <div className="card">
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "var(--radius-md)",
                background: "var(--status-warning-bg)",
                color: "var(--status-warning-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              ⚖️
            </div>
            <h3 className="card-title" style={{ fontSize: "1.125rem" }}>
              Multi-Tier Approvals
            </h3>
            <p className="card-meta" style={{ lineHeight: 1.5 }}>
              Enforce corporate travel policies. Managers review detailed itineraries,
              approve budgets, or request changes with mandatory explanatory notes.
              Self-approval is strictly prevented.
            </p>
            <Link
              href="/approvals"
              style={{
                fontSize: "0.875rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View Approvals Queue →
            </Link>
          </div>

          <div className="card">
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "var(--radius-md)",
                background: "var(--status-success-bg)",
                color: "var(--status-success-text)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              📍
            </div>
            <h3 className="card-title" style={{ fontSize: "1.125rem" }}>
              Store Visit Evidence
            </h3>
            <p className="card-meta" style={{ lineHeight: 1.5 }}>
              Field reps check in on-site with consent-driven GPS coordinates. Complete
              itemized merchandising checklists and submit signed photographic proof
              directly from retail aisles.
            </p>
            <Link
              href="/visits"
              style={{
                fontSize: "0.875rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Inspect Store Visits →
            </Link>
          </div>

          <div className="card">
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "var(--radius-md)",
                background: "#F5F3FF",
                color: "#6D28D9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              📊
            </div>
            <h3 className="card-title" style={{ fontSize: "1.125rem" }}>
              Operational Reporting & CSV
            </h3>
            <p className="card-meta" style={{ lineHeight: 1.5 }}>
              Compute planned vs actual stop compliance, track visit velocity across
              regional territories, and export spreadsheet-ready CSV files with
              formula-injection defenses built in.
            </p>
            <Link
              href="/reports"
              style={{
                fontSize: "0.875rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Explore Analytics →
            </Link>
          </div>

          <div className="card">
            <div
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "var(--radius-md)",
                background: "#ECFDF5",
                color: "var(--status-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.25rem",
              }}
            >
              ✨
            </div>
            <h3 className="card-title" style={{ fontSize: "1.125rem" }}>
              AI-Powered Visit Synthesis
            </h3>
            <p className="card-meta" style={{ lineHeight: 1.5 }}>
              Synthesize field rep audit notes, detect recurring competitor shelf-share
              shifts or refrigeration variances, and preview AI-assisted drafts requiring
              mandatory human review before saving.
            </p>
            <Link
              href="/ai-insights"
              style={{
                fontSize: "0.875rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View AI Insights →
            </Link>
          </div>
        </div>
      </section>

      {/* Role-Based Workflows */}
      <section
        aria-labelledby="roles-heading"
        className="card"
        style={{ padding: "2.5rem 2rem", background: "#FFFFFF" }}
      >
        <div style={{ textAlign: "center", maxWidth: "36rem", margin: "0 auto 2rem" }}>
          <h2 id="roles-heading" style={{ fontSize: "1.75rem", margin: "0 0 0.5rem" }}>
            Tailored for Every Operational Role
          </h2>
          <p className="card-meta">
            Strict role-based access control guarantees each team member sees precisely
            what they need.
          </p>
        </div>

        <div
          className="card-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}
        >
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-subtle)",
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--brand-primary)",
                textTransform: "uppercase",
              }}
            >
              Admin
            </span>
            <h3 style={{ fontSize: "1.125rem", margin: "0.5rem 0" }}>
              Workspace Governance
            </h3>
            <ul
              style={{
                paddingLeft: "1.25rem",
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <li>Manage organization accounts & seats</li>
              <li>Configure retail stores & territories</li>
              <li>Review security settings & audit logs</li>
              <li>Team invitations & role assignment</li>
            </ul>
          </div>

          <div
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-subtle)",
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--status-warning)",
                textTransform: "uppercase",
              }}
            >
              Manager
            </span>
            <h3 style={{ fontSize: "1.125rem", margin: "0.5rem 0" }}>
              Operations Oversight
            </h3>
            <ul
              style={{
                paddingLeft: "1.25rem",
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <li>Review & decide field trip requests</li>
              <li>Monitor real-time visit completions</li>
              <li>Review photo evidence & checklist logs</li>
              <li>Analyze operational KPI reports</li>
            </ul>
          </div>

          <div
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background: "var(--bg-subtle)",
            }}
          >
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                color: "var(--status-success)",
                textTransform: "uppercase",
              }}
            >
              Field Employee
            </span>
            <h3 style={{ fontSize: "1.125rem", margin: "0.5rem 0" }}>
              Aisle-Side Execution
            </h3>
            <ul
              style={{
                paddingLeft: "1.25rem",
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <li>Submit proposed travel itineraries</li>
              <li>Consent-based GPS store check-in</li>
              <li>Complete task checklists offline or online</li>
              <li>Capture endcap display photo evidence</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Enterprise Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-default)",
          paddingTop: "2rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              className="brand-icon-box"
              style={{ width: "1.5rem", height: "1.5rem", fontSize: "0.75rem" }}
            >
              F
            </div>
            <strong
              style={{ fontFamily: "var(--font-heading)", color: "var(--brand-dark)" }}
            >
              FieldTrack
            </strong>
          </div>
          <p
            className="card-meta"
            style={{ fontSize: "0.8125rem", margin: "0.25rem 0 0" }}
          >
            Enterprise B2B Field Operations & Travel Management Platform
          </p>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem" }}>
          <Link
            href="/"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Dashboard
          </Link>
          <Link
            href="/trips"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Trips
          </Link>
          <Link
            href="/approvals"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Approvals
          </Link>
          <Link
            href="/visits"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Visits
          </Link>
          <Link
            href="/reports"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Reports
          </Link>
          <Link
            href="/settings"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            Settings
          </Link>
        </div>

        <div
          style={{
            width: "100%",
            textAlign: "center",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border-default)",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          © 2026 FieldTrack Inc. Multi-tenant architecture with row-level security and
          verifiable field audit trails.
        </div>
      </footer>
    </div>
  );
}
