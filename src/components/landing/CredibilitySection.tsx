"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Layers, ClipboardCheck, Lock, Compass } from "lucide-react";

export function CredibilitySection(): ReactNode {
  const shouldReduceMotion = useReducedMotion();

  const benefits = [
    {
      title: "Eliminate Fragmented Tools",
      desc: "Replace chaotic chat threads, loose spreadsheets, and personal email chains with a single source of truth for itineraries, visit logs, and manager decisions.",
      icon: Layers,
    },
    {
      title: "Standardize Store Reporting",
      desc: "Enforce consistent, itemized checklists across every retail territory so regional managers evaluate compliance and execution with objective standards.",
      icon: ClipboardCheck,
    },
    {
      title: "Centralize Field Evidence",
      desc: "Organize store display photos, stock notes, and checklist receipts into private, tenant-isolated storage vaults accessible only by authorized team members.",
      icon: Lock,
    },
    {
      title: "Territory-Wide Visibility",
      desc: "Give headquarters and regional leaders live visibility into visit progress, route adherence, and store exceptions without micro-managing field reps.",
      icon: Compass,
    },
  ];

  return (
    <section className="credibility-section" aria-labelledby="credibility-heading">
      <div className="landing-section-container">
        <div className="section-header-centered">
          <span className="section-eyebrow">OPERATIONAL IMPACT</span>
          <h2 id="credibility-heading" className="section-title">
            Purpose-built to solve the real friction of distributed field teams.
          </h2>
          <p className="section-subtitle">
            Designed from day one for the operational realities of retail merchandising,
            FMCG sales execution, and distributed field supervisory networks.
          </p>
        </div>

        <motion.div
          className="credibility-grid"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="credibility-card">
                <div className="credibility-icon-box" aria-hidden="true">
                  <Icon size={20} />
                </div>
                <h3 className="credibility-card-title">{b.title}</h3>
                <p className="credibility-card-desc">{b.desc}</p>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
