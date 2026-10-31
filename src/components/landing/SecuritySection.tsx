"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck, MapPin, Lock, FileText, Scale } from "lucide-react";

export function SecuritySection(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section
      id="security"
      className="security-section"
      aria-labelledby="security-heading"
    >
      <div className="landing-section-container">
        {/* Section Header */}
        <motion.div
          className="section-header-centered"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">TRUST &amp; DATA ISOLATION</span>
          <h2 id="security-heading" className="section-title">
            Enterprise security and ethical location practices.
          </h2>
          <p className="section-subtitle">
            Operational visibility should never compromise employee privacy or workspace
            boundaries. FieldTrack is built from the ground up with mathematically
            enforced PostgreSQL data isolation and strictly purpose-specific GPS check-in
            verification.
          </p>
        </motion.div>

        {/* 4 Security Architecture Pillars */}
        <motion.div
          className="security-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          {/* Item 1: Organization Isolation */}
          <motion.div variants={itemVariants} className="security-card">
            <div className="security-icon-circle icon-shield" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <h3 className="security-card-title">Multi-Tenant Row-Level Security</h3>
            <p className="security-card-desc">
              Every database query and storage request is isolated at the PostgreSQL
              engine level. Row-Level Security (RLS) policies mathematically prevent one
              organization from ever reading or modifying another tenant&apos;s field
              itineraries, stores, or employee records.
            </p>
            <div className="security-tag-pill">
              <span>PostgreSQL RLS Hardened</span>
            </div>
          </motion.div>

          {/* Item 2: Location-Data Handling */}
          <motion.div variants={itemVariants} className="security-card">
            <div className="security-icon-circle icon-location" aria-hidden="true">
              <MapPin size={22} />
            </div>
            <h3 className="security-card-title">Consent-Driven, Point-in-Time GPS</h3>
            <p className="security-card-desc">
              Location coordinates are collected <em>only</em> at the exact moment a
              representative taps &ldquo;Check In&rdquo; or &ldquo;Check Out&rdquo; at a
              store. FieldTrack performs zero background monitoring, zero off-hours
              tracking, and does not record continuous travel routes.
            </p>
            <div className="security-tag-pill">
              <span>Zero Background Tracking</span>
            </div>
          </motion.div>

          {/* Item 3: Visit Evidence Vaults */}
          <motion.div variants={itemVariants} className="security-card">
            <div className="security-icon-circle icon-lock" aria-hidden="true">
              <Lock size={22} />
            </div>
            <h3 className="security-card-title">Private Evidence Vault</h3>
            <p className="security-card-desc">
              Store photos, planogram notes, and inspection surveys are stored in private
              Supabase Storage vaults. Access requires cryptographically signed URLs that
              expire automatically within 15 minutes and are restricted strictly to
              authorized workspace members.
            </p>
            <div className="security-tag-pill">
              <span>15-Minute Signed URLs</span>
            </div>
          </motion.div>

          {/* Item 4: Operational Auditability */}
          <motion.div variants={itemVariants} className="security-card">
            <div className="security-icon-circle icon-history" aria-hidden="true">
              <FileText size={22} />
            </div>
            <h3 className="security-card-title">Immutable Operational Audit Trails</h3>
            <p className="security-card-desc">
              Key operational events—including trip submissions, manager approval
              decisions, rejections, and store check-ins—are committed to append-only
              audit tables. Database triggers prevent retroactive tampering or deletion of
              historical operational decisions.
            </p>
            <div className="security-tag-pill">
              <span>Append-Only Event Ledger</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Security Transparency Callout */}
        <motion.div
          className="security-transparency-banner"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <div className="transparency-icon-box" aria-hidden="true">
            <Scale size={24} />
          </div>
          <div className="transparency-content">
            <h4 className="transparency-title">Our Operational Security Commitment</h4>
            <p className="transparency-text">
              We never fabricate compliance certifications or claim unverified third-party
              badges. Our platform security is founded on transparent, audited
              engineering: cryptographically signed sessions, HttpOnly cookies, verified
              least-privilege database roles, and formula-injection protection on every
              CSV data export.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
