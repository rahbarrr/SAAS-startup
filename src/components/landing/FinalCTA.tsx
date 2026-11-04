"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function FinalCTA(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="final-cta-section" aria-labelledby="final-cta-heading">
      <div className="landing-section-container">
        <motion.div
          className="final-cta-card"
          initial={{
            opacity: 0,
            y: shouldReduceMotion ? 0 : 16,
          }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
          style={{
            background: "#030407",
            borderRadius: "0.75rem",
            padding: "3.5rem 2rem",
            color: "#ffffff",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 4px 20px rgba(3, 4, 7, 0.4)",
          }}
        >
          <div
            className="final-cta-content"
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "42rem",
              margin: "0 auto",
            }}
          >
            <span
              className="final-cta-tag"
              style={{
                display: "inline-block",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#e2e8f0",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "0.3rem 0.75rem",
                borderRadius: "var(--radius-sm, 6px)",
                marginBottom: "1.25rem",
              }}
            >
              Start optimizing today
            </span>
            <h2
              id="final-cta-heading"
              className="final-cta-title"
              style={{
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                marginBottom: "1rem",
                color: "#ffffff",
                lineHeight: 1.2,
              }}
            >
              Bring Your Field Operations Together.
            </h2>
            <p
              className="final-cta-subhead"
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.8)",
                marginBottom: "2rem",
              }}
            >
              Coordinate trips, streamline field execution and gain better visibility into
              your operations with FieldTrack.
            </p>

            <div
              className="final-cta-buttons"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
                marginBottom: "1.75rem",
              }}
            >
              <Link
                href="/signup"
                className="btn btn-primary cta-btn-white"
                style={{
                  background: "#ffffff",
                  color: "#030407",
                  fontWeight: 600,
                  padding: "0.875rem 2rem",
                  borderRadius: "0.5rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
                }}
              >
                <span>Get Started</span>
                <span aria-hidden="true">→</span>
              </Link>
              <a
                href="#pricing"
                className="btn btn-secondary cta-btn-outline"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#ffffff",
                  borderColor: "rgba(255, 255, 255, 0.25)",
                  fontWeight: 500,
                  padding: "0.875rem 2rem",
                  borderRadius: "0.5rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>Explore Pricing</span>
              </a>
            </div>

            <div
              className="final-cta-trust"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1.5rem",
                flexWrap: "wrap",
                fontSize: "0.8125rem",
                color: "rgba(255, 255, 255, 0.75)",
              }}
            >
              <span>14-day evaluation pilot</span>
              <span>•</span>
              <span>Instant setup</span>
              <span>•</span>
              <span>No credit card required</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
