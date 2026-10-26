import type { ReactNode } from "react";

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
  badge?: ReactNode;
  variant?: "primary" | "warning" | "success" | "danger";
  formulaNote?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  badge,
  variant = "primary",
  formulaNote,
}: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-card--${variant}`}>
      <div className="card-header">
        <h3
          className="card-meta"
          style={{
            fontWeight: 600,
            fontSize: "0.8125rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </h3>
        {badge}
      </div>

      <div className="kpi-value">{value}</div>

      {trend ? (
        <div className={`kpi-trend kpi-trend--${trend.direction}`}>
          <span>
            {trend.direction === "up" && "↑"}
            {trend.direction === "down" && "↓"}
            {trend.direction === "neutral" && "•"}
          </span>
          <span>{trend.label}</span>
        </div>
      ) : null}

      {subtitle ? (
        <p className="card-meta" style={{ margin: "0.25rem 0 0" }}>
          {subtitle}
        </p>
      ) : null}

      {formulaNote ? (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "0.5rem",
            borderTop: "1px dashed var(--border-default)",
          }}
        >
          <span className="card-meta" style={{ fontSize: "0.75rem", display: "block" }}>
            <strong>Rule:</strong> {formulaNote}
          </span>
        </div>
      ) : null}
    </article>
  );
}
