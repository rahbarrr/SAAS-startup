"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarDays, ShieldCheck, CheckSquare2, BarChart2 } from "lucide-react";

interface StepItem {
  num: string;
  stageKey: string;
  stageName: string;
  summary: string;
  icon: typeof CalendarDays;
  points: string[];
}

const WORKFLOW_STEPS: readonly StepItem[] = [
  {
    num: "01",
    stageKey: "PLAN",
    stageName: "Plan",
    summary: "Create trips and organize store visits.",
    icon: CalendarDays,
    points: [
      "Select verified retail doors from directory",
      "Sequence stops to minimize drive mileage",
      "Submit structured itinerary with notes",
    ],
  },
  {
    num: "02",
    stageKey: "APPROVE",
    stageName: "Approve",
    summary: "Managers review and approve requests.",
    icon: ShieldCheck,
    points: [
      "Area manager inspects route and travel window",
      "Provide constructive comments or required adjustments",
      "Strict anti-tamper rule prevents rep self-approval",
    ],
  },
  {
    num: "03",
    stageKey: "EXECUTE",
    stageName: "Execute",
    summary: "Employees complete visits and capture evidence.",
    icon: CheckSquare2,
    points: [
      "Point-in-time GPS check-in at entrance geofence",
      "Complete mandatory store compliance checklists",
      "Upload photo evidence to encrypted tenant vaults",
    ],
  },
  {
    num: "04",
    stageKey: "MONITOR",
    stageName: "Monitor",
    summary: "Administrators review progress and performance.",
    icon: BarChart2,
    points: [
      "Live ground visibility of active field reps",
      "Identify out-of-stock items and store exceptions",
      "Export formula-safe CSV audit reports for analysis",
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
    <section
      id="how-it-works"
      className="workflow-section"
      aria-labelledby="workflow-heading"
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
          <span className="section-eyebrow">OPERATIONAL LIFECYCLE</span>
          <h2 id="workflow-heading" className="section-title">
            How FieldTrack works.
          </h2>
          <p className="section-subtitle">
            A reliable four-stage operational sequence that brings predictability,
            accountability, and auditability to every store visit.
          </p>
        </motion.div>

        {/* 4-Stage Workflow Timeline (Desktop horizontal, Mobile vertical) */}
        <motion.div
          className="workflow-timeline-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                variants={itemVariants}
                className="workflow-step-col"
              >
                <div className="step-badge-connector-wrap">
                  <div className="workflow-step-num-pill">
                    <span className="stage-index">{step.num}</span>
                    <span className="stage-key">{step.stageKey}</span>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div className="workflow-h-connector" aria-hidden="true" />
                  )}
                </div>

                <div className="workflow-card">
                  <div className="workflow-card-icon" aria-hidden="true">
                    <Icon size={20} />
                  </div>
                  <h3 className="workflow-step-title">{step.stageName}</h3>
                  <p className="workflow-step-summary">{step.summary}</p>

                  <ul className="workflow-points-list">
                    {step.points.map((point) => (
                      <li key={point}>
                        <span className="workflow-check-dot" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
