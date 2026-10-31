"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLORS } from "@/lib/design-system/tokens";

export interface PerformanceDataPoint {
  date: string;
  completed: number;
  scheduled: number;
}

export interface PerformanceAreaChartProps {
  data: PerformanceDataPoint[];
  height?: number;
  className?: string;
}

export function PerformanceAreaChart({
  data,
  height = 240,
  className,
}: PerformanceAreaChartProps) {
  return (
    <div className={className} style={{ width: "100%", height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
          <defs>
            <linearGradient id="gradientCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.brand.royal} stopOpacity={0.35} />
              <stop offset="95%" stopColor={COLORS.brand.royal} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradientScheduled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.brand.cyan} stopOpacity={0.35} />
              <stop offset="95%" stopColor={COLORS.brand.cyan} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
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
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
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
                      {label}
                    </strong>
                    {payload.map((entry) => (
                      <div
                        key={entry.name}
                        style={{
                          color: entry.color,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <span style={{ textTransform: "capitalize" }}>{entry.name}:</span>
                        <strong>{entry.value}</strong>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="completed"
            stroke={COLORS.brand.royal}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gradientCompleted)"
          />
          <Area
            type="monotone"
            dataKey="scheduled"
            stroke={COLORS.brand.cyanStrong}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#gradientScheduled)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
