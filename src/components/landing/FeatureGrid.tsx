"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedCard } from "@/components/animation";
import {
  MapPin,
  ShieldCheck,
  Navigation,
  Target,
  CheckSquare,
  Users,
  BarChart3,
  Building2,
  ArrowUpRight,
} from "lucide-react";

export interface CoreFeatureItem {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof MapPin;
  colorClass: string;
  badge: string;
  linkHref: string;
  previewSnippet: {
    label: string;
    value: string;
    sub: string;
  };
}

export const CORE_FEATURES: readonly CoreFeatureItem[] = [
  {
    id: "trip-planning",
    title: "Trip Planning & Management",
    tagline: "Sequential multi-stop itineraries with distance calculation",
    description:
      "Build optimized travel schedules across assigned territories. Calculate route mileage, order retail stops logically, and prevent scheduling conflicts.",
    icon: MapPin,
    colorClass: "var(--brand-primary, #293f91)",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Optimized Route",
      value: "4 Stops • 48.2 km",
      sub: "Google Maps sequential waypoint routing",
    },
  },
  {
    id: "approval-workflows",
    title: "Manager Approval Workflows",
    tagline: "Structured review inbox with full audit history",
    description:
      "Review submitted itineraries with clear distance estimates and purpose notes. Approve, request changes, or reject with documented feedback. Self-approvals are strictly blocked.",
    icon: ShieldCheck,
    colorClass: "var(--brand-violet, #8875f7)",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Approval Decision",
      value: "Status: Approved",
      sub: "Reviewed by Regional Lead • 09:30 AM",
    },
  },
  {
    id: "live-location",
    title: "Live Location Visibility",
    tagline: "Point-in-time check-in coordinates and manager map",
    description:
      "Supervisors can visualize field team progress on an interactive territory map. View verified check-in coordinates and route milestones without battery-draining continuous tracking.",
    icon: Navigation,
    colorClass: "var(--brand-cyan, #38d9d6)",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Field Territory Map",
      value: "3 Active Reps • 12 Visits",
      sub: "Latest Check-in: 14 mins ago",
    },
  },
  {
    id: "geofencing-visits",
    title: "Geofencing & Store Visits",
    tagline: "Radius-verified check-ins at retail doors",
    description:
      "Ensure reps are physically at the store before beginning an audit. FieldTrack verifies device GPS coordinates against store boundary coordinates with custom tolerance radiuses.",
    icon: Target,
    colorClass: "#10b981",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Geofence Verification",
      value: "Match: 38m to entrance",
      sub: "Threshold: 150m radius • Confirmed",
    },
  },
  {
    id: "checklists-evidence",
    title: "Checklists & Evidence Vault",
    tagline: "Structured surveys, photos, and offline drafts",
    description:
      "Standardize store merchandising audits with digital checklists, stock out indicators, and photo evidence stored in tenant-isolated vaults with signed 15-minute access URLs.",
    icon: CheckSquare,
    colorClass: "#f59e0b",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Inspection Checklist",
      value: "8/8 Items Verified",
      sub: "2 display photos uploaded & encrypted",
    },
  },
  {
    id: "team-management",
    title: "Team & Employee Management",
    tagline: "Granular roles, email invitations, and seat quotas",
    description:
      "Invite area managers and field reps with one click. Manage active seats, assign supervisory relationships, and control member access across regional retail branches.",
    icon: Users,
    colorClass: "#6366f1",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Workspace Directory",
      value: "14 Active Members",
      sub: "Admin, Manager, and Field Rep seats",
    },
  },
  {
    id: "reporting-analytics",
    title: "Operational Reporting & Analytics",
    tagline: "Territory completion rates and injection-safe CSV exports",
    description:
      "Track scheduled vs completed visits, audit pass rates, and territory velocity. Export clean, sanitized CSV reports protected against formula injection for Excel analysis.",
    icon: BarChart3,
    colorClass: "#0ea5e9",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Territory Completion",
      value: "94.2% On-Schedule",
      sub: "CSV audit log export ready",
    },
  },
  {
    id: "org-role-management",
    title: "Organization & Role Management",
    tagline: "Multi-tenant isolation backed by PostgreSQL RLS",
    description:
      "Strict PostgreSQL Row-Level Security policies isolate every query by organization ID. Role-based permissions guarantee reps only see assigned trips while managers oversee their region.",
    icon: Building2,
    colorClass: "#ec4899",
    badge: "Available",
    linkHref: "#showcase",
    previewSnippet: {
      label: "Security Hardening",
      value: "PostgreSQL RLS Active",
      sub: "Tenant ID scoped on every table query",
    },
  },
];

export function FeatureGrid(): ReactNode {
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
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section
      id="features"
      className="feature-grid-section"
      aria-labelledby="features-heading"
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
          <span className="section-eyebrow">COMPLETE CAPABILITY SUITE</span>
          <h2 id="features-heading" className="section-title">
            Built specifically for field execution and operational rigor.
          </h2>
          <p className="section-subtitle">
            Every feature in FieldTrack is engineered to solve real friction for reps on
            the road and managers in regional offices. No bloat. Pure operational clarity.
          </p>
        </motion.div>

        {/* 8 Features Grid (2x4 on desktop, 1x8 on mobile) */}
        <motion.div
          className="features-grid-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          {CORE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div key={feature.id} variants={itemVariants}>
                <AnimatedCard className="feature-card-full">
                  <div className="feature-card-top">
                    <div
                      className="feature-icon-wrapper"
                      style={{ color: feature.colorClass }}
                      aria-hidden="true"
                    >
                      <Icon size={22} />
                    </div>
                    <span className="feature-status-pill">{feature.badge}</span>
                  </div>

                  <h3 className="feature-full-title">{feature.title}</h3>
                  <p className="feature-full-tagline">{feature.tagline}</p>
                  <p className="feature-full-desc">{feature.description}</p>

                  {/* UI Preview Snippet */}
                  <div className="feature-snippet-box">
                    <div className="snippet-header">
                      <span className="snippet-dot" aria-hidden="true" />
                      <span className="snippet-label">
                        {feature.previewSnippet.label}
                      </span>
                    </div>
                    <div className="snippet-val">{feature.previewSnippet.value}</div>
                    <div className="snippet-sub">{feature.previewSnippet.sub}</div>
                  </div>

                  <a href={feature.linkHref} className="feature-explore-link">
                    <span>View in Showcase</span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
