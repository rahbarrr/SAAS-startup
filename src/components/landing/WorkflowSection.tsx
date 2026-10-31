"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

interface StepItem {
  num: string;
  phase: string;
  title: string;
  summary: string;
  points: string[];
}

const WORKFLOW_STEPS: readonly StepItem[] = [
  {
    num: "01",
    phase: "Step 1",
    title: "Plan",
    summary: "Create trips and organize store visits.",
    points: [
      "Select verified retail doors",
      "Sequence multi-stop itineraries",
      "Submit for manager review",
    ],
  },
  {
    num: "02",
    phase: "Step 2",
    title: "Execute",
    summary: "Complete field visits, checklists and evidence capture.",
    points: [
      "Point-in-time GPS check-in",
      "Complete required inspection items",
      "Upload verified photographic evidence",
    ],
  },
  {
    num: "03",
    phase: "Step 3",
    title: "Monitor",
    summary: "Review approvals, team activity and operational performance.",
    points: [
      "Process travel approvals promptly",
      "Review planned vs. actual adherence",
      "Export formula-safe CSV audit reports",
    ],
  },
];

export function WorkflowSection(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.15,
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
      id="how-it-works"
      className="workflow-section"
      aria-labelledby="workflow-heading"
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
          <span className="section-eyebrow">HOW FIELDTRACK WORKS</span>
          <h2 id="workflow-heading" className="section-title">
            Simple, structured field execution.
          </h2>
          <p className="section-subtitle">
            A reliable 3-step operational cycle that ensures accountability before,
            during, and after every store visit.
          </p>
        </motion.div>

        {/* 3-Step Sequence */}
        <motion.div
          className="workflow-sequence workflow-sequence-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.75rem",
            position: "relative",
          }}
        >
          {WORKFLOW_STEPS.map((step, idx) => (
            <motion.div
              key={step.num}
              variants={itemVariants}
              className="workflow-step-card"
              style={{
                background: "#f5f6fa",
                border: "1px solid rgba(255, 255, 255, 0.95)",
                borderRadius: "1rem",
                padding: "2rem 1.75rem",
                boxShadow: "0 4px 16px rgba(41, 63, 145, 0.05)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  className="workflow-step-top"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1.25rem",
                  }}
                >
                  <span
                    className="workflow-step-num"
                    style={{
                      fontSize: "1.75rem",
                      fontWeight: 800,
                      color: "var(--brand-primary, #293f91)",
                      opacity: 0.85,
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {step.num}
                  </span>
                  <span
                    className="workflow-step-pill"
                    style={{
                      background: "rgba(41, 63, 145, 0.08)",
                      color: "var(--brand-primary, #293f91)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.25rem 0.625rem",
                      borderRadius: "9999px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {step.phase}
                  </span>
                </div>

                <h3
                  className="workflow-step-title"
                  style={{
                    fontSize: "1.375rem",
                    fontWeight: 700,
                    marginBottom: "0.5rem",
                    color: "#20243a",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  className="workflow-step-desc"
                  style={{
                    fontSize: "0.9375rem",
                    lineHeight: 1.6,
                    color: "#626b80",
                    marginBottom: "1.5rem",
                  }}
                >
                  {step.summary}
                </p>
              </div>

              <div
                className="workflow-step-preview"
                style={{
                  background: "#ffffff",
                  borderRadius: "0.625rem",
                  padding: "1rem",
                  border: "1px solid rgba(41, 63, 145, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {step.points.map((pt) => (
                  <div
                    key={pt}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.8125rem",
                      color: "#20243a",
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background:
                          idx === 0 ? "#293f91" : idx === 1 ? "#8875f7" : "#38d9d6",
                        flexShrink: 0,
                      }}
                    />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
