"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { COLORS } from "@/lib/design-system/tokens";

export interface StatusDistributionChartItem {
  status: string;
  count: number;
  label: string;
  color?: string;
}

export interface StatusDistributionChartProps {
  data: StatusDistributionChartItem[];
  height?: number;
  className?: string;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  submitted: COLORS.status.warning,
  approved: COLORS.brand.royal,
  in_progress: COLORS.brand.cyanStrong,
  completed: COLORS.status.success,
  changes_requested: "#EA580C",
  rejected: COLORS.status.danger,
  draft: "#64748B",
};

export function StatusDistributionChart({
  data,
  height = 240,
  className,
}: StatusDistributionChartProps) {
  return (
    <div className={className} style={{ width: "100%", height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
          <XAxis
            dataKey="label"
            stroke="var(--text-muted, #6b7287)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "var(--border-default, #e5e7eb)" }}
          />
          <YAxis
            stroke="var(--text-muted, #6b7287)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0]?.payload as StatusDistributionChartItem;
                return (
                  <div
                    style={{
                      background: "var(--bg-surface, #ffffff)",
                      border: "1px solid var(--border-default, #e5e7eb)",
                      borderRadius: "var(--radius-md, 0.5rem)",
                      padding: "0.5rem 0.75rem",
                      boxShadow: "var(--shadow-sm)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <strong style={{ color: "var(--text-primary, #20243a)" }}>
                      {item.label}
                    </strong>
                    <div style={{ color: "var(--text-secondary, #626b80)" }}>
                      Total Itineraries: <strong>{item.count}</strong>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={`cell-${entry.status}`}
                fill={
                  entry.color ?? DEFAULT_STATUS_COLORS[entry.status] ?? COLORS.brand.royal
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
