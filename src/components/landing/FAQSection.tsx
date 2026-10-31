"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: readonly FAQItem[] = [
  {
    id: "faq-what",
    question: "What is FieldTrack?",
    answer:
      "FieldTrack is a centralized field operations management platform designed to plan field trips, manage approvals, record verified store visits, and monitor operational performance from a single workspace.",
  },
  {
    id: "faq-who",
    question: "Who can use FieldTrack?",
    answer:
      "FieldTrack is built for retail operations, FMCG sales teams, merchandisers, and field supervisors with dedicated roles for Administrators, Area Managers, and Field Representatives.",
  },
  {
    id: "faq-approvals",
    question: "How does trip approval work?",
    answer:
      "Field reps build multi-stop itineraries and submit them for review. Managers inspect the route in their approval inbox and approve, reject, or request changes with documented feedback. Self-approvals are strictly blocked.",
  },
  {
    id: "faq-visits",
    question: "Can employees record store visits?",
    answer:
      "Yes. Field representatives check in at scheduled retail doors, complete custom inspection checklists, record stock conditions, and upload photo evidence directly from their mobile browser.",
  },
  {
    id: "faq-location",
    question: "Does FieldTrack support location tracking?",
    answer:
      "FieldTrack uses consent-driven, point-in-time GPS check-ins at store locations to verify attendance and geofence proximity. It does not monitor continuous background movement or track employees off duty.",
  },
  {
    id: "faq-started",
    question: "How do I get started?",
    answer:
      "Sign up for a workspace in seconds with no credit card required. You can immediately create a territory, invite team members, and begin scheduling store visits.",
  },
];

export function FAQSection(): ReactNode {
  const [openId, setOpenId] = useState<string | null>("faq-what");
  const shouldReduceMotion = useReducedMotion();

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <section id="faq" className="faq-section" aria-labelledby="faq-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <motion.div
          className="section-header-centered"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
          <h2 id="faq-heading" className="section-title">
            Answers to common questions.
          </h2>
          <p className="section-subtitle">
            Everything you need to know about FieldTrack&apos;s features, privacy, and
            workflows.
          </p>
        </motion.div>

        {/* FAQ Accordion List */}
        <div
          className="faq-accordion-container"
          style={{ maxWidth: "48rem", margin: "0 auto" }}
        >
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`faq-accordion-item ${isOpen ? "is-expanded" : ""}`}
                style={{
                  borderBottom: "1px solid rgba(41, 63, 145, 0.1)",
                  padding: "1rem 0",
                }}
              >
                <button
                  type="button"
                  id={`header-${item.id}`}
                  className="faq-accordion-trigger"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`content-${item.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: "0.5rem 0",
                    cursor: "pointer",
                    fontSize: "1.0625rem",
                    fontWeight: 600,
                    color: "#20243a",
                  }}
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.25s ease",
                      fontSize: "1.25rem",
                      color: "#293f91",
                      marginLeft: "1rem",
                      flexShrink: 0,
                    }}
                  >
                    ↓
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`content-${item.id}`}
                      role="region"
                      aria-labelledby={`header-${item.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <p
                        className="faq-answer-text"
                        style={{
                          margin: "0.5rem 0 1rem",
                          fontSize: "0.9375rem",
                          lineHeight: 1.6,
                          color: "#626b80",
                        }}
                      >
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
