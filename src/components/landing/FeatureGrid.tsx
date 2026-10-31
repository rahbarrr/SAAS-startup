"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AnimatedCard } from "@/components/animation";
import { MapPin, ShieldCheck, CheckSquare, BarChart3 } from "lucide-react";

interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: typeof MapPin;
  colorClass: string;
  tag: string;
}

const CORE_FEATURES: readonly FeatureItem[] = [
  {
    id: "trip-management",
    title: "Trip Management",
    description: "Plan trips, organize destinations and manage field schedules.",
    icon: MapPin,
    colorClass: "var(--brand-primary, #293f91)",
    tag: "Planning",
  },
  {
    id: "approval-workflows",
    title: "Approval Workflows",
    description: "Review and manage employee trip requests.",
    icon: ShieldCheck,
    colorClass: "var(--brand-violet, #8875f7)",
    tag: "Governance",
  },
  {
    id: "visit-execution",
    title: "Store Visit Execution",
    description: "Record visits, complete checklists and capture evidence.",
    icon: CheckSquare,
    colorClass: "var(--brand-cyan, #38d9d6)",
    tag: "Field Action",
  },
  {
    id: "operational-visibility",
    title: "Operational Visibility",
    description: "Monitor team activity and review operational performance.",
    icon: BarChart3,
    colorClass: "var(--brand-navy, #20243a)",
    tag: "Analytics",
  },
];

export function FeatureGrid(): ReactNode {
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
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
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
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">CORE FEATURES</span>
          <h2 id="features-heading" className="section-title">
            Essential tools for field operations.
          </h2>
          <p className="section-subtitle">
            Four cohesive capabilities designed to eliminate guesswork, enforce standard
            operating procedures, and provide reliable visibility.
          </p>
        </motion.div>

        {/* 4 Feature Cards Grid */}
        <motion.div
          className="feature-cards-grid feature-cards-grid-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {CORE_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.id}
                variants={itemVariants}
                style={{ height: "100%" }}
              >
                <AnimatedCard
                  className="feature-card"
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "2rem 1.75rem",
                    borderRadius: "1rem",
                    background: "#ffffff",
                    border: "1px solid rgba(41, 63, 145, 0.08)",
                  }}
                >
                  <div>
                    <div
                      className="feature-card-top"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "1.25rem",
                      }}
                    >
                      <div
                        className="feature-icon-box"
                        style={{
                          width: "3rem",
                          height: "3rem",
                          borderRadius: "0.75rem",
                          background: "rgba(41, 63, 145, 0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color:
                            feature.colorClass === "var(--brand-cyan, #38d9d6)"
                              ? "#0284c7"
                              : feature.colorClass,
                        }}
                        aria-hidden="true"
                      >
                        <Icon size={24} strokeWidth={2} />
                      </div>
                      <span className="feature-status-tag tag-live">{feature.tag}</span>
                    </div>

                    <h3
                      className="feature-title"
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        marginBottom: "0.5rem",
                        color: "#20243a",
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className="feature-desc"
                      style={{
                        fontSize: "0.9375rem",
                        lineHeight: 1.6,
                        color: "#626b80",
                        margin: 0,
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
