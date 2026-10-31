"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Unplug,
  Route,
  FileCheck2,
  EyeOff,
  Activity,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface OperationalChallenge {
  id: string;
  number: string;
  title: string;
  challenge: string;
  solution: string;
  icon: typeof Unplug;
}

const OPERATIONAL_CHALLENGES: readonly OperationalChallenge[] = [
  {
    id: "disconnected-ops",
    number: "01",
    title: "Disconnected Field Operations",
    challenge:
      "Field teams, dispatchers, and area managers rely on fragmented chat groups and phone calls, losing operational context.",
    solution:
      "FieldTrack provides a single tenant-isolated workspace where reps, managers, and admins share verified itineraries and status.",
    icon: Unplug,
  },
  {
    id: "unorganized-trips",
    number: "02",
    title: "Unorganized Trip Planning",
    challenge:
      "Reps waste hours manually drafting travel routes without real-time distance optimization or store priority schedules.",
    solution:
      "Interactive Google Maps route optimization arranges stops into sequential, mileage-efficient itineraries with one click.",
    icon: Route,
  },
  {
    id: "manual-approvals",
    number: "03",
    title: "Manual Approval Processes",
    challenge:
      "Trip requests sit lost in email inboxes or get informally approved over text with zero auditability or budget tracking.",
    solution:
      "Hierarchical approval inboxes let managers review route stops, estimated mileage, and leave formal feedback before travel.",
    icon: FileCheck2,
  },
  {
    id: "store-visibility",
    number: "04",
    title: "Limited Store Visit Visibility",
    challenge:
      "Headquarters has no reliable confirmation that a rep physically arrived at a retail door or completed required audits.",
    solution:
      "Point-in-time GPS check-ins verify attendance within the retail store geofence radius without intrusive continuous tracking.",
    icon: EyeOff,
  },
  {
    id: "monitoring-execution",
    number: "05",
    title: "Difficulty Monitoring Field Execution",
    challenge:
      "Area managers spend afternoons chasing reps for check-in updates rather than focusing on high-value merchandising exceptions.",
    solution:
      "Live operational dashboards display active trips, in-progress visits, completed stops, and store condition alerts in real time.",
    icon: Activity,
  },
  {
    id: "fragmented-reporting",
    number: "06",
    title: "Fragmented Operational Reporting",
    challenge:
      "End-of-week summaries submitted in disparate spreadsheets vary in accuracy and make cross-territory benchmarking impossible.",
    solution:
      "Standardized store checklists, photo vaults, and sanitized CSV exports provide consistent executive analytics across all territories.",
    icon: FileSpreadsheet,
  },
];

export function ProductOverviewSection(): ReactNode {
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
      id="product"
      className="product-overview-section"
      aria-labelledby="overview-heading"
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
          <span className="section-eyebrow">THE OPERATIONAL TRANSFORMATION</span>
          <h2 id="overview-heading" className="section-title">
            From fragmented field chaos to centralized operational control.
          </h2>
          <p className="section-subtitle">
            Field teams operate across hundreds of retail doors. When trip planning,
            approvals, visit verification, and territory analytics live in different
            silos, operations grind to a halt. FieldTrack unifies every step into one
            seamless workflow.
          </p>
        </motion.div>

        {/* 6 Operational Challenges & Solutions Grid */}
        <motion.div
          className="overview-challenges-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          {OPERATIONAL_CHALLENGES.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                variants={itemVariants}
                className="challenge-solution-card"
              >
                <div className="card-top-meta">
                  <span className="challenge-num">{item.number}</span>
                  <div className="challenge-icon-wrap" aria-hidden="true">
                    <Icon size={18} />
                  </div>
                </div>

                <h3 className="challenge-title">{item.title}</h3>

                <div className="challenge-problem-block">
                  <span className="block-label text-danger">Friction:</span>
                  <p className="block-text">{item.challenge}</p>
                </div>

                <div className="challenge-solution-block">
                  <div className="solution-indicator">
                    <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
                    <span className="block-label text-success">FieldTrack Solution:</span>
                  </div>
                  <p className="block-text solution-text">{item.solution}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* How FieldTrack Brings Them Together Banner */}
        <motion.div
          className="overview-synthesis-banner"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <div className="synthesis-badge">UNIFIED ARCHITECTURE</div>
          <h3 className="synthesis-title">
            One connected loop: Plan, Approve, Execute, and Analyze.
          </h3>
          <p className="synthesis-desc">
            Instead of stitching together five disconnected tools, FieldTrack links every
            scheduled visit to its trip approval, geofenced GPS check-in, store checklist
            evidence, and executive territory report.
          </p>
          <div className="synthesis-flow-steps">
            <span className="flow-pill">1. Itinerary Planning</span>
            <ArrowRight size={14} className="flow-arrow" aria-hidden="true" />
            <span className="flow-pill">2. Manager Review</span>
            <ArrowRight size={14} className="flow-arrow" aria-hidden="true" />
            <span className="flow-pill">3. GPS Store Check-in</span>
            <ArrowRight size={14} className="flow-arrow" aria-hidden="true" />
            <span className="flow-pill">4. Territory Analytics</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
