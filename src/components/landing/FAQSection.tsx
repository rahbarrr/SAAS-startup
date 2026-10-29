"use client";

import { useState, type ReactNode } from "react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: readonly FAQItem[] = [
  {
    id: "faq-1",
    question: "What is field operations management software?",
    answer:
      "Field operations management software provides a structured, digital system for coordinating mobile sales reps, merchandisers, and field auditors. It replaces ad-hoc spreadsheets, WhatsApp chats, and paper forms with structured trip scheduling, managerial travel approvals, GPS-verified store check-ins, standardized inspection checklists, and centralized reporting.",
  },
  {
    id: "faq-2",
    question: "Which industries can use FieldTrack?",
    answer:
      "FieldTrack is specifically optimized for Fast-Moving Consumer Goods (FMCG), consumer packaged goods (CPG), retail distribution networks, pharmacy chains, beverage distributors, and franchise operations where sales reps and trade merchandisers regularly visit retail stores, dealerships, or distributor locations.",
  },
  {
    id: "faq-3",
    question: "How does trip approval work?",
    answer:
      "When a field employee creates an itinerary with travel dates and planned store stops, the trip moves to a 'submitted' status. The designated manager receives an alert in their approval queue, where they review the sequence, distance, and objectives. The manager can approve the trip, reject it, or request changes with required explanatory notes. Crucially, the system strictly enforces database rules that prevent employees from approving their own trips.",
  },
  {
    id: "faq-4",
    question: "How are store visits recorded?",
    answer:
      "Upon arriving at an authorized store location, the representative taps 'Check In'. The app records point-in-time GPS coordinates, timestamps, and an idempotent token to verify proximity to the retail door. Representatives must complete all required checklist items before the 'Check Out' action unlocks, ensuring audit completeness.",
  },
  {
    id: "faq-5",
    question: "Can employees attach photographs and visit evidence?",
    answer:
      "Yes. Representatives can capture endcap displays, planogram shelves, promotional cooler gauges, and condition photos directly through their mobile browser. All uploaded files are stored in private, tenant-isolated storage buckets and accessed via short-lived signed URLs (15-minute expiration) restricted to authorized workspace members.",
  },
  {
    id: "faq-6",
    question: "Does the platform support managers and employees with different permissions?",
    answer:
      "Yes. FieldTrack implements strict role-based access control (RBAC) with three distinct roles: Administrator (workspace governance, store master data, billing, and audit logs), Manager (trip approval queue, territory execution monitoring, and performance reporting), and Field Employee (itinerary access, authorized check-in/out, checklists, and evidence submission). PostgreSQL Row-Level Security policies enforce these boundaries across all operations.",
  },
  {
    id: "faq-7",
    question: "How does the platform handle GPS check-ins? Does it track employees continuously?",
    answer:
      "FieldTrack does not track employee location in the background or monitor continuous movements. Location coordinates are queried strictly with explicit user consent at the single moment an employee triggers a store 'Check In' or 'Check Out'. This guarantees operational verification while respecting field employee privacy.",
  },
  {
    id: "faq-8",
    question: "Does the platform support AI-assisted reporting?",
    answer:
      "Yes. FieldTrack includes an AI synthesis engine that turns unstructured rep notes and checklist responses into drafted visit summaries, highlighting key observations (like planogram compliance or cooler temperature variances) and suggesting follow-up items. Crucially, all AI output is saved with status 'pending_review'—a human employee or manager must explicitly review and accept the draft before it becomes permanent.",
  },
  {
    id: "faq-9",
    question: "Is there a mobile experience?",
    answer:
      "FieldTrack is built as a responsive progressive web application (PWA) with offline resilience. Field representatives can use any standard smartphone browser to access daily itineraries, perform check-ins, fill out checklists, and upload photos directly from retail aisles without needing to install an unverified third-party app.",
  },
  {
    id: "faq-10",
    question: "How can a company get started?",
    answer:
      "You can sign up directly for our 14-day Pilot Trial. Setup takes less than two minutes: create your organization, invite up to 5 team members, add your first 15 retail stores, and begin planning trips immediately—no credit card required.",
  },
];

export function FAQSection(): ReactNode {
  const [openId, setOpenId] = useState<string | null>("faq-1");

  function toggleItem(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <section className="faq-section" aria-labelledby="faq-heading">
      <div className="landing-section-container">
        {/* Section Header */}
        <div className="section-header-centered">
          <span className="section-eyebrow">CLEAR ANSWERS</span>
          <h2 id="faq-heading" className="section-title">
            Frequently Asked Questions
          </h2>
          <p className="section-subtitle">
            Everything you need to know about FieldTrack, operational workflows, location practices,
            and evaluation pilots.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="faq-accordion-container" role="region" aria-label="FAQ Accordion">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`faq-item ${isOpen ? "is-expanded" : ""}`}
              >
                <h3>
                  <button
                    type="button"
                    className="faq-question-btn"
                    onClick={() => toggleItem(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${item.id}`}
                    id={`faq-question-${item.id}`}
                  >
                    <span className="faq-question-text">{item.question}</span>
                    <span className="faq-chevron" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`chevron-icon ${isOpen ? "rotated" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>
                </h3>

                <div
                  id={`faq-answer-${item.id}`}
                  role="region"
                  aria-labelledby={`faq-question-${item.id}`}
                  className={`faq-answer-panel ${isOpen ? "is-visible" : ""}`}
                  hidden={!isOpen}
                >
                  <div className="faq-answer-inner">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

