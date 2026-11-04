"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ProductDashboardPreview } from "./ProductDashboardPreview";
import { ShieldCheck, MapPin, CheckCircle2 } from "lucide-react";

export function LandingHero(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: 0.04,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.35, ease: [0.2, 0, 0, 1] as const },
    },
  };

  return (
    <section
      className="landing-hero"
      aria-labelledby="hero-heading"
      style={{ position: "relative", overflow: "hidden" }}
    >
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
            <Link href="/signup" className="btn btn-primary hero-primary-btn">
              <span>Get Started</span>
              <span aria-hidden="true">→</span>
            </Link>
            <a href="#showcase" className="btn btn-secondary hero-secondary-btn">
              <span>Explore Platform</span>
            </a>
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

        {/* Product Dashboard Preview with Authentic Grounded Interface */}
        <motion.div
          className="hero-visual-container hero-preview-container"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15, ease: [0.2, 0, 0, 1] as const }}
          style={{ position: "relative" }}
        >
          <ProductDashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}
