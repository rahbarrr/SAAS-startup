"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DynamicThreeDHeroScene } from "@/components/3d";
import { ProductDashboardPreview } from "./ProductDashboardPreview";
import { ScaleOnHover } from "@/components/animation";
import { ShieldCheck, MapPin, CheckCircle2 } from "lucide-react";

export function LandingHero(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
        delayChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section
      className="landing-hero"
      aria-labelledby="hero-heading"
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Background 3D Ambient Visual Layer */}
      <div
        className="hero-3d-backdrop"
        style={{
          position: "absolute",
          top: "-5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "100vw",
          height: "480px",
          pointerEvents: "none",
          opacity: 0.5,
          zIndex: 0,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <DynamicThreeDHeroScene />
      </div>

      <div className="landing-hero-container" style={{ position: "relative", zIndex: 1 }}>
        <motion.div
          className="hero-content-stack"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* Eyebrow Pill */}
          <motion.div variants={itemVariants} className="hero-eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            <span className="eyebrow-text">FIELD OPERATIONS MANAGEMENT PLATFORM</span>
          </motion.div>

          {/* Headline requested in Phase 3 Section 2 */}
          <motion.h1 id="hero-heading" variants={itemVariants} className="hero-headline">
            Take Control of Every{" "}
            <span className="headline-accent">Field Operation.</span>
          </motion.h1>

          {/* Supporting Description requested in Phase 3 Section 2 */}
          <motion.p variants={itemVariants} className="hero-subhead">
            Plan field trips, streamline approvals, coordinate store visits and gain
            visibility into team execution — all from one centralized platform.
          </motion.p>

          {/* Primary and Secondary CTA Buttons */}
          <motion.div variants={itemVariants} className="hero-cta-group">
            <ScaleOnHover scale={1.03}>
              <Link href="/signup" className="btn btn-primary hero-primary-btn">
                <span>Get Started</span>
                <span aria-hidden="true">→</span>
              </Link>
            </ScaleOnHover>
            <ScaleOnHover scale={1.02}>
              <a href="#showcase" className="btn btn-secondary hero-secondary-btn">
                <span>Explore Platform</span>
              </a>
            </ScaleOnHover>
          </motion.div>

          {/* Enterprise trust & capability tags */}
          <motion.div variants={itemVariants} className="hero-trust-badges">
            <div className="hero-trust-item">
              <CheckCircle2 size={14} className="trust-icon" aria-hidden="true" />
              <span>Multi-stop route planning</span>
            </div>
            <div className="hero-trust-item">
              <ShieldCheck size={14} className="trust-icon" aria-hidden="true" />
              <span>Hierarchical manager approvals</span>
            </div>
            <div className="hero-trust-item">
              <MapPin size={14} className="trust-icon" aria-hidden="true" />
              <span>GPS geofenced check-ins</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Product Dashboard Preview with Interactive Floating Operational UI */}
        <motion.div
          className="hero-visual-container hero-preview-container"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
          style={{ position: "relative" }}
        >
          {/* Floating Operational Pill 1 (Top-Left) */}
          <div className="hero-floating-pill pill-top-left" aria-hidden="true">
            <div className="pill-dot pill-dot-green" />
            <div>
              <div className="pill-label">Trip Approved • 4 Stops</div>
              <div className="pill-sub">Midwest FMCG Territory • Ready</div>
            </div>
          </div>

          {/* Floating Operational Pill 2 (Bottom-Right) */}
          <div className="hero-floating-pill pill-bottom-right" aria-hidden="true">
            <div className="pill-dot pill-dot-cyan" />
            <div>
              <div className="pill-label">Store Visit Verified</div>
              <div className="pill-sub">Target #1042 • GPS Check-in 42m</div>
            </div>
          </div>

          <ProductDashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}
