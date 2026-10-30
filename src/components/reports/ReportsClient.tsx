"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { buildManagerReportCsv } from "@/modules/reporting/csv";
import type { OperationsReportSummary } from "@/modules/reporting/domain";

export interface ReportsClientProps {
  initialReport: OperationsReportSummary;
  orgId?: string | null;
  userRole?: string;
}

export function ReportsClient({ initialReport, orgId }: ReportsClientProps) {
  const { showToast } = useToast();
  const [report, setReport] = useState<OperationsReportSummary>(initialReport);
  const initialRange =
    initialReport.timeWindow.range === "7d" ||
    initialReport.timeWindow.range === "30d" ||
    initialReport.timeWindow.range === "quarter" ||
    initialReport.timeWindow.range === "ytd"
      ? initialReport.timeWindow.range
      : "30d";
  const [selectedRange, setSelectedRange] = useState<"7d" | "30d" | "quarter" | "ytd">(
    initialRange
  );
  const [selectedTerritory, setSelectedTerritory] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isFirstMountRef = useRef(true);

  const fetchReport = useCallback(
    async (range: string, territory: string) => {
      if (!orgId) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const query = new URLSearchParams({
          range,
          ...(territory !== "all" ? { territory } : {}),
        });

        const res = await fetch(`/api/orgs/${orgId}/reports?${query.toString()}`);
        const envelope = await res.json();

        if (!res.ok || !envelope.data) {
          throw new Error(envelope.error?.message || "Failed to load operations report.");
        }

        setReport(envelope.data);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading reports.";
        setErrorMessage(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (orgId) {
      void fetchReport(selectedRange, selectedTerritory);
    }
  }, [selectedRange, selectedTerritory, fetchReport, orgId]);

  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      const csvString = buildManagerReportCsv(report.rows);
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `fieldtrack-operations-${selectedRange}-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        "CSV generated and downloaded with RFC 4180 and OWASP formula safety.",
        "success"
      );
    } catch {
      showToast("Unable to assemble CSV report export.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredReps =
    selectedTerritory === "all"
      ? report.repPerformance
      : report.repPerformance.filter((r) =>
          r.territory.toLowerCase().includes(selectedTerritory.toLowerCase())
        );

  const territories = Array.from(
    new Set(report.territorySummary.map((t) => t.territory))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Top Controls Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "1rem 1.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--brand-dark)",
            }}
          >
            Time Window:
          </span>
          <div
            style={{
              display: "flex",
              gap: "0.25rem",
              background: "var(--border-subtle)",
              padding: "0.25rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            {[
              { id: "7d" as const, label: "Last 7 Days" },
              { id: "30d" as const, label: "Trailing 30 Days" },
              { id: "quarter" as const, label: "Quarter" },
              { id: "ytd" as const, label: "Year to Date" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedRange(tab.id);
                  showToast(`Displaying metrics for ${tab.label}`, "info");
                }}
                style={{
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.8125rem",
                  fontWeight: selectedRange === tab.id ? 600 : 500,
                  color:
                    selectedRange === tab.id
                      ? "var(--brand-primary)"
                      : "var(--text-secondary)",
                  background: selectedRange === tab.id ? "var(--surface)" : "transparent",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  boxShadow: selectedRange === tab.id ? "var(--shadow-sm)" : "none",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {isLoading ? (
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--brand-primary)",
                fontWeight: 600,
              }}
            >
              Updating report…
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <select
            value={selectedTerritory}
            onChange={(e) => setSelectedTerritory(e.target.value)}
            className="input-field"
            style={{ width: "auto", minWidth: "180px", height: "38px" }}
            aria-label="Filter performance by territory"
          >
            <option value="all">All Territories</option>
            {territories.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting || report.rows.length === 0}
            className="btn btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {isExporting ? "Generating CSV..." : "Export Clean CSV"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <ErrorState
          title="Failed to Load Operations Report"
          message={errorMessage}
          onRetry={() => void fetchReport(selectedRange, selectedTerritory)}
        />
      ) : null}

      {/* KPI Cards Strip */}
      <div className="kpi-grid">
        <KpiCard
          title="Visit Execution Rate"
          value={`${report.kpis.visitCompletionRate}%`}
          subtitle="Planned vs actual completed field visits"
          trend={{
            direction: "up",
            label: `${report.kpis.completedTrips} of ${report.kpis.totalTrips} trips complete`,
          }}
          variant="success"
        />
        <KpiCard
          title="Audit Compliance Score"
          value={`${report.kpis.auditComplianceScore}%`}
          subtitle="Stores passing clean 4-point checklist"
          trend={{
            direction: "up",
            label: `${report.kpis.activeStoresCount} active store doors`,
          }}
          variant="success"
        />
        <KpiCard
          title="Total Field Hours"
          value={`${report.kpis.totalFieldHours}h`}
          subtitle="Cumulative on-site execution duration"
          trend={{
            direction: "neutral",
            label: `${report.rows.length} planned stops`,
          }}
          variant="primary"
        />
        <KpiCard
          title="Approval Turnaround"
          value={
            report.kpis.approvalTurnaroundHoursAvg !== null
              ? `${report.kpis.approvalTurnaroundHoursAvg}h`
              : "—"
          }
          subtitle="Avg submission-to-decision time"
          trend={{
            direction: report.kpis.exceptionsLogged > 0 ? "down" : "neutral",
            label: `${report.kpis.exceptionsLogged} exceptions flagged`,
          }}
          variant={report.kpis.exceptionsLogged > 0 ? "warning" : "primary"}
        />
        <KpiCard
          title="Evidence Capture Rate"
          value={`${report.kpis.evidenceCompletionRate ?? 100}%`}
          subtitle="Completed visits with verified photo/sign evidence"
          trend={{
            direction: "up",
            label: "Audit-ready evidence attachments",
          }}
          variant="success"
        />
        <KpiCard
          title="Overdue Visits"
          value={`${report.kpis.overdueVisitsCount ?? 0}`}
          subtitle="Planned stops past trip deadline"
          trend={{
            direction: (report.kpis.overdueVisitsCount ?? 0) > 0 ? "down" : "neutral",
            label:
              (report.kpis.overdueVisitsCount ?? 0) > 0
                ? "Requires attention"
                : "All on schedule",
          }}
          variant={(report.kpis.overdueVisitsCount ?? 0) > 0 ? "warning" : "primary"}
        />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState
          title="No operational records for this period"
          description={`No field trips or visits were recorded for ${report.timeWindow.label} in the selected territory.`}
          actionLabel="View Trips"
          actionHref="/trips"
        />
      ) : (
        <>
          {/* Charts Section: Trips by Status + Weekly Execution Trend */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Trips by Status */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="card-header" style={{ marginBottom: "1rem" }}>
                <div>
                  <h2
                    style={{
                      fontSize: "1.125rem",
                      fontFamily: "var(--font-heading)",
                      color: "var(--brand-dark)",
                      margin: "0 0 0.25rem",
                    }}
                  >
                    Trips by Operational Status
                  </h2>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Total {report.kpis.totalTrips} field trips in active scope
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.875rem",
                }}
              >
                {report.tripsByStatus.map((item) => (
                  <div
                    key={item.status}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.label}
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {item.count} trips ({item.percentage}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: "8px",
                        width: "100%",
                        background: "var(--border-subtle)",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${item.percentage}%`,
                          background: item.color,
                          borderRadius: "4px",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Store Visit Velocity */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="card-header" style={{ marginBottom: "1rem" }}>
                <div>
                  <h2
                    style={{
                      fontSize: "1.125rem",
                      fontFamily: "var(--font-heading)",
                      color: "var(--brand-dark)",
                      margin: "0 0 0.25rem",
                    }}
                  >
                    Store Visit Velocity (Pacing)
                  </h2>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Completed visits vs organizational target pacing
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {report.weeklyVisitsTrend.map((w) => (
                  <div
                    key={w.week}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem",
                      background: "var(--bg-canvas)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          color: "var(--brand-dark)",
                        }}
                      >
                        {w.week}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Target: {w.target} visits
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "1.125rem",
                            fontWeight: 700,
                            color: "var(--brand-primary)",
                          }}
                        >
                          {w.visits}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {" "}
                          completed
                        </span>
                      </div>
                      <span
                        className="status-badge"
                        style={{
                          background: "rgba(5, 150, 105, 0.12)",
                          color: "var(--success-green)",
                          border: "1px solid rgba(5, 150, 105, 0.25)",
                        }}
                      >
                        {w.compliance}% Score
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Field Rep Performance Table */}
          <div className="card">
            <div
              className="card-header"
              style={{
                padding: "1.25rem",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "1.125rem",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-dark)",
                    margin: "0 0 0.25rem",
                  }}
                >
                  Representative Execution &amp; Audit Summary
                </h2>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Performance metrics for field representatives across assigned
                  territories
                </p>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Showing {filteredReps.length} of {report.repPerformance.length}{" "}
                representatives
              </span>
            </div>

            <div className="table-responsive">
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Representative</th>
                    <th>Assigned Territory</th>
                    <th>Completed Visits</th>
                    <th>Pending / Overdue</th>
                    <th>Completion %</th>
                    <th>Avg. Duration</th>
                    <th>Exceptions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReps.map((rep) => (
                    <tr key={rep.userId}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.625rem",
                          }}
                        >
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "rgba(27, 53, 128, 0.1)",
                              color: "var(--brand-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                            }}
                          >
                            {rep.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {rep.name}
                            </div>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {rep.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {rep.territory}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--brand-dark)",
                          }}
                        >
                          {rep.completedVisits} / {rep.plannedStops}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {rep.outstandingAssignments ?? 0} pending
                          {(rep.overdueStops ?? 0) > 0 ? (
                            <span
                              style={{
                                color: "var(--danger-red, #ef4444)",
                                marginLeft: "0.25rem",
                                fontWeight: 600,
                              }}
                            >
                              ({rep.overdueStops} overdue)
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <div
                            style={{
                              width: "50px",
                              height: "6px",
                              background: "var(--border-subtle)",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${rep.completionRate}%`,
                                height: "100%",
                                background: "var(--success-green)",
                              }}
                            />
                          </div>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                            {rep.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {rep.avgVisitDurationMin} mins
                        </span>
                      </td>
                      <td>
                        {rep.exceptionsFlagged > 0 ? (
                          <span
                            className="status-badge"
                            style={{
                              background: "rgba(217, 119, 6, 0.12)",
                              color: "var(--warning-amber)",
                              border: "1px solid rgba(217, 119, 6, 0.25)",
                            }}
                          >
                            {rep.exceptionsFlagged} Flagged
                          </span>
                        ) : (
                          <span
                            className="status-badge"
                            style={{
                              background: "rgba(5, 150, 105, 0.12)",
                              color: "var(--success-green)",
                              border: "1px solid rgba(5, 150, 105, 0.25)",
                            }}
                          >
                            Clean
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Territory Summary Grid */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div className="card-header" style={{ marginBottom: "1rem" }}>
              <div>
                <h2
                  style={{
                    fontSize: "1.125rem",
                    fontFamily: "var(--font-heading)",
                    color: "var(--brand-dark)",
                    margin: "0 0 0.25rem",
                  }}
                >
                  Territory Coverage &amp; Operational Health
                </h2>
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Regional breakdown of assigned retail doors and visit compliance
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))",
                gap: "1rem",
              }}
            >
              {report.territorySummary.map((t) => (
                <div
                  key={t.territory}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      color: "var(--brand-dark)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {t.territory}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.375rem",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>Active Doors:</span>
                      <span style={{ fontWeight: 600 }}>{t.storeCount} stores</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>Visits Done:</span>
                      <span style={{ fontWeight: 600 }}>
                        {t.completedVisits} / {t.scheduledVisits}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>Coverage:</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--brand-primary)",
                        }}
                      >
                        {t.coveragePercentage}%
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        Audit Compliance:
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--success-green)",
                        }}
                      >
                        {t.compliance}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>Missed Visits:</span>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            (t.missedVisits ?? 0) > 0
                              ? "var(--warning-amber, #d97706)"
                              : "inherit",
                        }}
                      >
                        {t.missedVisits ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Store Visit Frequency Table */}
          {report.storeVisitAnalytics && report.storeVisitAnalytics.length > 0 ? (
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="card-header" style={{ marginBottom: "1rem" }}>
                <div>
                  <h2
                    style={{
                      fontSize: "1.125rem",
                      fontFamily: "var(--font-heading)",
                      color: "var(--brand-dark)",
                      margin: "0 0 0.25rem",
                    }}
                  >
                    Store Visit Frequency &amp; Missed Visits
                  </h2>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--text-secondary)",
                      margin: 0,
                    }}
                  >
                    Account-level door frequency, completion rates, and last visit
                    timestamps
                  </p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Store Name</th>
                      <th>Territory</th>
                      <th>Planned Visits</th>
                      <th>Completed</th>
                      <th>Missed</th>
                      <th>Completion %</th>
                      <th>Last Visited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.storeVisitAnalytics.map((s) => (
                      <tr key={s.storeId}>
                        <td style={{ fontWeight: 600, color: "var(--brand-dark)" }}>
                          {s.storeName}
                        </td>
                        <td>{s.storeRegion}</td>
                        <td>{s.plannedVisitsCount}</td>
                        <td style={{ fontWeight: 600, color: "var(--success-green)" }}>
                          {s.completedVisitsCount}
                        </td>
                        <td
                          style={{
                            fontWeight: 600,
                            color:
                              s.missedVisitsCount > 0
                                ? "var(--warning-amber)"
                                : "var(--text-muted)",
                          }}
                        >
                          {s.missedVisitsCount}
                        </td>
                        <td>{s.completionRate}%</td>
                        <td
                          style={{
                            fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {s.lastVisitedAt ? s.lastVisitedAt.slice(0, 10) : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Operational Reporting Governance Notice */}
      <div
        style={{
          padding: "0.875rem 1.25rem",
          background: "rgba(27, 53, 128, 0.04)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <svg
          width="20"
          height="20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="var(--brand-primary)"
          style={{ flexShrink: 0 }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          <strong>Operational Reporting Governance:</strong> All timestamps and date
          boundaries are evaluated in UTC according to enterprise reporting
          specifications. Coordinates and visit evidence are point-in-time check-in/out
          records, protected by Row Level Security and role-based permissions.
        </span>
      </div>
    </div>
  );
}
