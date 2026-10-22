"use client";

import Link from "next/link";
import { type ChangeEvent, type ReactNode, useState, useTransition } from "react";
import {
  signOutAction,
  switchActiveOrganizationAction,
} from "@/modules/auth/actions";
import type { OrgRole } from "@/modules/tenancy/domain";

export interface OrgSwitcherOption {
  orgId: string;
  orgName: string;
  role: OrgRole;
}

export interface OrgSwitcherProps {
  activeOrgId?: string;
  activeOrgName: string;
  activeRole: OrgRole;
  organizations?: readonly OrgSwitcherOption[];
  userEmail?: string | null;
}

const ROLE_LABELS: Readonly<Record<OrgRole, string>> = {
  admin: "Org Admin",
  manager: "Field Manager",
  field_employee: "Field Employee",
};

export function OrgSwitcher({
  activeOrgId,
  activeOrgName,
  activeRole,
  organizations = [],
  userEmail = null,
}: OrgSwitcherProps): ReactNode {
  const [isPending, startTransition] = useTransition();
  const [switchError, setSwitchError] = useState<string | null>(null);

  function handleOrgChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextOrgId = event.target.value;
    setSwitchError(null);
    startTransition(async () => {
      const result = await switchActiveOrganizationAction({ orgId: nextOrgId });
      if (!result.ok) {
        setSwitchError(result.error ?? "Unable to switch organization.");
      }
    });
  }

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}
    >
      {organizations.length > 1 ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <label
            htmlFor="org-switcher-select"
            style={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            Organization:
          </label>
          <select
            id="org-switcher-select"
            aria-label="Switch active organization"
            value={activeOrgId ?? organizations[0]?.orgId ?? ""}
            onChange={handleOrgChange}
            disabled={isPending}
            style={{
              minHeight: "var(--touch-target-min)",
              padding: "0.375rem 0.75rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontWeight: 600,
              fontSize: "0.875rem",
            }}
          >
            {organizations.map((org) => (
              <option key={org.orgId} value={org.orgId}>
                {org.orgName} ({ROLE_LABELS[org.role]})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div
          className="org-pill"
          aria-label={`Active organization: ${activeOrgName}, role: ${ROLE_LABELS[activeRole]}`}
        >
          <span>{activeOrgName}</span>
          <span aria-hidden="true">•</span>
          <span>{ROLE_LABELS[activeRole]}</span>
        </div>
      )}

      {switchError ? (
        <span
          role="alert"
          style={{
            fontSize: "0.8125rem",
            color: "var(--status-danger-text)",
            fontWeight: 600,
          }}
        >
          {switchError}
        </span>
      ) : null}

      {userEmail ? (
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="btn btn-secondary"
          style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
        >
          Sign Out
        </button>
      ) : (
        <Link
          href="/login"
          className="btn btn-secondary"
          style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
        >
          Sign In
        </Link>
      )}
    </div>
  );
}
