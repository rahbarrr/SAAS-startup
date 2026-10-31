"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DynamicThreeDHeroScene } from "@/components/3d";
import { ProductDashboardPreview } from "./ProductDashboardPreview";
import { ScaleOnHover } from "@/components/animation";

export function LandingHero(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
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
      {/* Subtle Background 3D Visual Mesh - Non-intrusive ambient layer */}
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
          opacity: 0.55,
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

          {/* Headline */}
          <motion.h1 id="hero-heading" variants={itemVariants} className="hero-headline">
            Every Field Visit. Every Trip.{" "}
            <span className="headline-accent">One Platform.</span>
          </motion.h1>

          {/* Supporting Description */}
          <motion.p variants={itemVariants} className="hero-subhead">
            Plan field trips, manage approvals, track store visits and monitor team
            execution from one centralized workspace.
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
              <a href="#product" className="btn btn-secondary hero-secondary-btn">
                Explore Platform
              </a>
            </ScaleOnHover>
          </motion.div>

          {/* Supporting Trust Message */}
          <motion.p
            variants={itemVariants}
            className="hero-guarantee-note"
            style={{ maxWidth: "560px", margin: "1rem auto 2.5rem" }}
          >
            Built for teams that need visibility, accountability and efficient field
            operations.
          </motion.p>
        </motion.div>

        {/* Large Product Dashboard Preview with Entrance Animation */}
        <motion.div
          className="hero-visual-container"
          initial={{
            opacity: 0,
            y: shouldReduceMotion ? 0 : 32,
            scale: shouldReduceMotion ? 1 : 0.98,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", perspective: 1200 }}
        >
          <ProductDashboardPreview />
        </motion.div>
      </div>
    </section>
  );
}
