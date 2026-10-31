"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ShieldAlert, Compass, Smartphone, Check } from "lucide-react";

export function RoleBasedSection(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section id="solutions" className="roles-section" aria-labelledby="roles-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <motion.div
          className="section-header-centered"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">SOLUTIONS BY ROLE</span>
          <h2 id="roles-heading" className="section-title">
            Tailored workflows for every level of field operations.
          </h2>
          <p className="section-subtitle">
            Whether governing an entire enterprise, coordinating regional territories, or
            executing retail visits on the road, FieldTrack delivers the exact views and
            permissions your team needs.
          </p>
        </motion.div>

        {/* 3 Role Cards Grid */}
        <motion.div
          className="roles-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          {/* Role 1: Administrators */}
          <motion.div variants={itemVariants} className="role-card">
            <div className="role-card-header">
              <span className="role-badge badge-role-admin">Administrator</span>
              <span className="role-scope">Governance & Control</span>
            </div>

            <h3 className="role-title">Enterprise Oversight & Security</h3>
            <p className="role-desc">
              Organization oversight, user management, master store directory governance,
              operational visibility and sanitized executive reporting.
            </p>

            <ul className="role-feature-list">
              <li>
                <Check size={14} className="role-check" aria-hidden="true" />
                <span>
                  <strong>Tenant Isolation:</strong> Manage workspaces, member seats, and
                  billing tiers with zero cross-tenant data leaks.
                </span>
              </li>
              <li>
                <Check size={14} className="role-check" aria-hidden="true" />
                <span>
                  <strong>Store Master Data:</strong> Import, geocode, and assign retail
                  doors across territories and franchise accounts.
                </span>
              </li>
              <li>
                <Check size={14} className="role-check" aria-hidden="true" />
                <span>
                  <strong>Audit Log Trail:</strong> Immutable security logs documenting
                  every user authorization, check-in, and status change.
                </span>
              </li>
            </ul>

            {/* Role-Specific Preview Snippet */}
            <div className="role-preview-box">
              <div className="role-preview-header">
                <ShieldAlert size={14} aria-hidden="true" />
                <span>Admin Governance Console</span>
              </div>
              <div className="role-preview-stat">
                <span>Active Seats: 14/15</span>
                <span>RLS Enforced: 100%</span>
              </div>
            </div>
          </motion.div>

          {/* Role 2: Managers */}
          <motion.div variants={itemVariants} className="role-card role-card-featured">
            <div className="featured-role-flag">PRIMARY SUPERVISORY WORKFLOW</div>
            <div className="role-card-header">
              <span className="role-badge badge-role-manager">
                Area & Regional Manager
              </span>
              <span className="role-scope">Oversight & Decisions</span>
            </div>

            <h3 className="role-title">Trip Approvals & Live Supervision</h3>
            <p className="role-desc">
              Trip approvals, team monitoring, ground visibility, visit performance, and
              instant resolution of stockout exceptions.
            </p>

            <ul className="role-feature-list">
              <li>
                <Check size={14} className="role-check check-accent" aria-hidden="true" />
                <span>
                  <strong>Approval Queue:</strong> Inspect multi-stop itineraries, review
                  estimated mileage, and record feedback.
                </span>
              </li>
              <li>
                <Check size={14} className="role-check check-accent" aria-hidden="true" />
                <span>
                  <strong>Ground Visibility:</strong> Area manager maps show point-in-time
                  verified check-in milestones for each active rep.
                </span>
              </li>
              <li>
                <Check size={14} className="role-check check-accent" aria-hidden="true" />
                <span>
                  <strong>Audit Feedback:</strong> Review photo evidence and store display
                  conditions directly from mobile or desktop.
                </span>
              </li>
            </ul>

            {/* Role-Specific Preview Snippet */}
            <div className="role-preview-box preview-featured">
              <div className="role-preview-header">
                <Compass size={14} aria-hidden="true" />
                <span>Manager Approval Queue</span>
              </div>
              <div className="role-preview-stat">
                <span>3 Pending Approvals</span>
                <span>Avg Response: 18m</span>
              </div>
            </div>
          </motion.div>

          {/* Role 3: Field Employees */}
          <motion.div variants={itemVariants} className="role-card">
            <div className="role-card-header">
              <span className="role-badge badge-role-rep">Field Representative</span>
              <span className="role-scope">Execution & Evidence</span>
            </div>

            <h3 className="role-title">Assigned Trips & Verified Visits</h3>
            <p className="role-desc">
              Assigned trips, store visits, GPS verification, standardized checklists and
              photo evidence capture directly from the road.
            </p>

            <ul className="role-feature-list">
              <li>
                <Check size={14} className="role-check" aria-hidden="true" />
                <span>
                  <strong>Route Navigation:</strong> Follow optimized sequential stops
                  with store addresses, contact numbers, and visit objectives.
                </span>
              </li>
              <li>
                <Check size={14} className="role-check" aria-hidden="true" />
                <span>
                  <strong>Point-in-Time GPS:</strong> Seamless check-ins at store doors
                  with geofence radius verification and offline sync.
                </span>
              </li>
              <li>
                <Check size={14} className="role-check" aria-hidden="true" />
                <span>
                  <strong>Digital Audits:</strong> Complete checklists, note out-of-stock
                  items, and upload display photos in seconds.
                </span>
              </li>
            </ul>

            {/* Role-Specific Preview Snippet */}
            <div className="role-preview-box">
              <div className="role-preview-header">
                <Smartphone size={14} aria-hidden="true" />
                <span>Mobile Field Check-in</span>
              </div>
              <div className="role-preview-stat">
                <span>GPS Check-in: 32m</span>
                <span>Offline Draft: Synced</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
