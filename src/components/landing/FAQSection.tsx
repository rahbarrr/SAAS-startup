"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

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
      "FieldTrack is an enterprise-grade field operations management platform that connects field representatives, area managers, and operations leaders. It centralizes trip itinerary planning, manager approval queues, GPS-verified store visits, photo evidence vaults, and territory compliance analytics in one secure workspace.",
  },
  {
    id: "faq-who",
    question: "Who can use FieldTrack?",
    answer:
      "FieldTrack is built for retail operations, consumer packaged goods (CPG/FMCG) distribution teams, merchandising networks, and field inspection services. It features specialized interfaces and permission models for Administrators, Area Managers, and Field Representatives.",
  },
  {
    id: "faq-trips",
    question: "How does trip planning work?",
    answer:
      "Field representatives build multi-stop itineraries directly from their workspace store directory. Stops are sequenced to minimize drive time and travel distance using Google Maps route calculations. Itineraries include travel dates, visit objectives, and estimated allowances before submission.",
  },
  {
    id: "faq-approvals",
    question: "How do managers approve trips?",
    answer:
      "Managers access a dedicated approval inbox where submitted itineraries can be inspected stop by stop. Managers can approve trips, request specific adjustments, or reject them with documented audit notes. Self-approvals are strictly blocked at the database engine level.",
  },
  {
    id: "faq-visits",
    question: "How do store visits work?",
    answer:
      "When a representative arrives at a retail door, they initiate a check-in. The platform verifies GPS coordinates against the store geofence radius. The rep completes structured inspection checklists, logs inventory conditions or stockouts, and uploads photo evidence before checking out.",
  },
  {
    id: "faq-location",
    question: "How is location tracking handled?",
    answer:
      "FieldTrack practices ethical, consent-driven location verification. GPS coordinates are captured only at the exact moments of store check-in and checkout to confirm attendance. We do not run background location services or monitor employees off duty.",
  },
  {
    id: "faq-pricing",
    question: "What pricing plans are available?",
    answer:
      "FieldTrack offers a 14-day free Pilot Trial (up to 5 members and 15 stores) for evaluation, a Pro tier at $149/month (including 15 seats and 150 stores), and an Enterprise tier at $499/month (including 50 seats and up to 10,000 stores) with custom SLA and onboarding.",
  },
  {
    id: "faq-started",
    question: "How can an organization get started?",
    answer:
      "You can create an organization workspace in seconds at /signup with no credit card required. Once registered, administrators can import their retail store directory, configure territories, invite team members with specific roles, and immediately begin scheduling field visits.",
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
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.05 }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-eyebrow">RESOURCES &amp; ANSWERS</span>
          <h2 id="faq-heading" className="section-title">
            Frequently asked questions.
          </h2>
          <p className="section-subtitle">
            Everything you need to know about FieldTrack&apos;s workflows, location
            ethics, security policies, and subscription model.
          </p>
        </motion.div>

        {/* FAQ Accordion List */}
        <div
          className="faq-accordion-list"
          role="region"
          aria-label="Frequently Asked Questions"
        >
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className={`faq-item-card ${isOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  id={`faq-btn-${item.id}`}
                  className="faq-question-btn"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                >
                  <span className="faq-question-text">{item.question}</span>
                  <ChevronDown
                    size={18}
                    className="faq-chevron"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${item.id}`}
                      role="region"
                      aria-labelledby={`faq-btn-${item.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.25,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="faq-answer-inner">
                        <p>{item.answer}</p>
                      </div>
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
