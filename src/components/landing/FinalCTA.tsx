"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ScaleOnHover } from "@/components/animation";

export function FinalCTA(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="final-cta-section" aria-labelledby="final-cta-heading">
      <div className="landing-section-container">
        <motion.div
          className="final-cta-card"
          initial={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.98,
            y: shouldReduceMotion ? 0 : 20,
          }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: "linear-gradient(135deg, #293f91 0%, #1f2d6b 100%)",
            borderRadius: "1.25rem",
            padding: "4rem 2rem",
            color: "#ffffff",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(41, 63, 145, 0.2)",
          }}
        >
          {/* Subtle Decorative Gradient Orbs */}
          <div
            className="cta-glow-element"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-50%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: "600px",
              height: "300px",
              background:
                "radial-gradient(circle, rgba(136, 117, 247, 0.35) 0%, rgba(56, 217, 214, 0.1) 60%, transparent 80%)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />

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
                background: "rgba(255, 255, 255, 0.15)",
                color: "#38d9d6",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.35rem 0.85rem",
                borderRadius: "9999px",
                marginBottom: "1.25rem",
              }}
            >
              START OPTIMIZING TODAY
            </span>
            <h2
              id="final-cta-heading"
              className="final-cta-title"
              style={{
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                fontWeight: 800,
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
                fontSize: "1.125rem",
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.88)",
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
              <ScaleOnHover scale={1.03}>
                <Link
                  href="/signup"
                  className="btn btn-primary cta-btn-white"
                  style={{
                    background: "#ffffff",
                    color: "#293f91",
                    fontWeight: 700,
                    padding: "0.875rem 2rem",
                    borderRadius: "0.5rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  <span>Get Started</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </ScaleOnHover>
              <ScaleOnHover scale={1.02}>
                <a
                  href="#pricing"
                  className="btn btn-secondary cta-btn-outline"
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    color: "#ffffff",
                    borderColor: "rgba(255, 255, 255, 0.35)",
                    fontWeight: 600,
                    padding: "0.875rem 2rem",
                    borderRadius: "0.5rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span>Explore Pricing</span>
                </a>
              </ScaleOnHover>
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
              <span>✓ 14-day evaluation pilot</span>
              <span>✓ Instant setup</span>
              <span>✓ No credit card required</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
