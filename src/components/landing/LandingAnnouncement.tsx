import Link from "next/link";
import type { ReactNode } from "react";

export function LandingAnnouncement(): ReactNode {
  return (
    <aside aria-label="Announcement" className="landing-announcement">
      <div className="landing-announcement-content">
        <span className="announcement-pill">Evaluation Pilot</span>
        <span className="announcement-text">
          Now accepting FMCG & retail operations teams for 14-day structured evaluation
          pilots.
        </span>
        <Link href="/signup" className="announcement-link">
          <span>Apply for Pilot</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}
