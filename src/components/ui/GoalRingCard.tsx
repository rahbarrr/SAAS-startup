import Link from "next/link";
import type { ReactNode } from "react";

export interface GoalRingSegment {
  label: string;
  value: string | number;
}

export interface GoalRingCardProps {
  title: string;
  subtitle: string;
  value: string | number;
  totalLabel?: string;
  targetText?: string;
  percentage: number;
  icon?: ReactNode;
  tone?: "blue" | "obsidian" | "emerald" | "amber" | "danger";
  variant?: "primary" | "dark" | "success" | "warning" | "danger";
  badge?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  ruleSummary?: string;
  primarySegmentLabel?: string;
  secondarySegmentLabel?: string;
  primarySegment?: GoalRingSegment;
  secondarySegment?: GoalRingSegment;
}

const VARIANT_TO_TONE: Record<
  NonNullable<GoalRingCardProps["variant"]>,
  NonNullable<GoalRingCardProps["tone"]>
> = {
  primary: "blue",
  dark: "obsidian",
  success: "emerald",
  warning: "amber",
  danger: "danger",
};

const TONE_COLORS: Record<
  NonNullable<GoalRingCardProps["tone"]>,
  {
    iconBg: string;
    iconFg: string;
    ringStroke: string;
    barPrimary: string;
    barSecondary: string;
  }
> = {
  blue: {
    iconBg: "#216A85",
    iconFg: "#FFFFFF",
    ringStroke: "#216A85",
    barPrimary: "#216A85",
    barSecondary: "#65A7C2",
  },
  obsidian: {
    iconBg: "#021D24",
    iconFg: "#C7E5F2",
    ringStroke: "#042933",
    barPrimary: "#042933",
    barSecondary: "#65A7C2",
  },
  emerald: {
    iconBg: "#216A85",
    iconFg: "#FFFFFF",
    ringStroke: "#216A85",
    barPrimary: "#216A85",
    barSecondary: "#65A7C2",
  },
  amber: {
    iconBg: "#042933",
    iconFg: "#C7E5F2",
    ringStroke: "#093F52",
    barPrimary: "#093F52",
    barSecondary: "#65A7C2",
  },
  danger: {
    iconBg: "#021D24",
    iconFg: "#FFFFFF",
    ringStroke: "#EF4444",
    barPrimary: "#EF4444",
    barSecondary: "#FCA5A5",
  },
};

export function GoalRingCard({
  title,
  subtitle,
  value,
  totalLabel,
  targetText,
  percentage,
  icon,
  tone,
  variant,
  badge,
  actionHref,
  actionLabel,
  ruleSummary,
  primarySegmentLabel,
  secondarySegmentLabel,
  primarySegment,
  secondarySegment,
}: GoalRingCardProps): ReactNode {
  const safePct = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePct / 100) * circumference;
  const resolvedTone = tone ?? (variant ? VARIANT_TO_TONE[variant] : "blue");
  const palette = TONE_COLORS[resolvedTone];
  const resolvedTotalLabel = totalLabel ?? targetText;
  const resolvedPrimaryLabel =
    primarySegmentLabel ??
    (primarySegment ? `${primarySegment.label} • ${primarySegment.value}` : undefined);
  const resolvedSecondaryLabel =
    secondarySegmentLabel ??
    (secondarySegment
      ? `${secondarySegment.label} • ${secondarySegment.value}`
      : undefined);

  const defaultIcon = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );

  return (
    <article className="kpi-card bento-ring-card">
      {/* Top Header: Icon Circle + Title/Subtitle + Badge */}
      <div className="bento-ring-header">
        <div
          className="bento-ring-icon"
          style={{ background: palette.iconBg, color: palette.iconFg }}
          aria-hidden="true"
        >
          {icon ?? defaultIcon}
        </div>
        <div className="bento-ring-titles">
          <h2 className="bento-ring-title kpi-label">{title}</h2>
          <p className="bento-ring-subtitle kpi-subtitle">{subtitle}</p>
        </div>
        {badge ? <div className="bento-ring-badge">{badge}</div> : null}
      </div>

      {/* Middle Row: Circular Progress Gauge + Primary Value */}
      <div className="bento-ring-body">
        <div className="bento-ring-gauge" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle
              cx="36"
              cy="36"
              r={radius}
              fill="none"
              stroke="var(--border-subtle, #E8ECF4)"
              strokeWidth="6.5"
            />
            <circle
              cx="36"
              cy="36"
              r={radius}
              fill="none"
              stroke={palette.ringStroke}
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 36 36)"
              style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.2, 0, 0, 1)" }}
            />
          </svg>
          <span className="bento-ring-pct">{safePct}%</span>
        </div>

        <div className="bento-ring-metric">
          <div className="kpi-value bento-ring-value">{value}</div>
          {resolvedTotalLabel ? (
            <div className="bento-ring-total">{resolvedTotalLabel}</div>
          ) : null}
        </div>
      </div>

      {/* Bottom Progress Bar & Footer */}
      <div className="bento-ring-footer">
        <div className="bento-ring-bar-track" aria-hidden="true">
          <div
            className="bento-ring-bar-primary"
            style={{
              width: `${Math.max(8, safePct)}%`,
              background: palette.barPrimary,
            }}
          />
          <div
            className="bento-ring-bar-secondary"
            style={{
              width: `${Math.max(6, 100 - safePct)}%`,
              background: palette.barSecondary,
            }}
          />
        </div>

        {(resolvedPrimaryLabel || resolvedSecondaryLabel) ? (
          <div className="bento-ring-legend">
            {resolvedPrimaryLabel ? (
              <span className="bento-ring-legend-item">
                <span
                  className="bento-ring-legend-dot"
                  style={{ background: palette.barPrimary }}
                />
                {resolvedPrimaryLabel}
              </span>
            ) : null}
            {resolvedSecondaryLabel ? (
              <span className="bento-ring-legend-item">
                <span
                  className="bento-ring-legend-dot"
                  style={{ background: palette.barSecondary }}
                />
                {resolvedSecondaryLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {(actionHref || ruleSummary) ? (
          <div className="kpi-card-footer">
            {actionHref && actionLabel ? (
              <Link href={actionHref} className="btn btn-sm btn-outline kpi-action-btn">
                {actionLabel}
              </Link>
            ) : null}
            {ruleSummary ? (
              <details className="kpi-rule-details">
                <summary className="kpi-rule-summary" title="View calculation rule">
                  Rule
                </summary>
                <div className="kpi-rule-content">
                  <strong>Rule:</strong> {ruleSummary}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
