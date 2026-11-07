import Link from "next/link";
import type { OrgRole, Permission } from "@/modules/tenancy/domain";

interface PermissionDeniedStateProps {
  title?: string;
  message: string;
  currentRole: OrgRole;
  requiredPermission?: Permission | string;
  returnHref?: string;
  returnLabel?: string;
}

export function PermissionDeniedState({
  title = "Access Denied — Insufficient Role Permissions",
  message,
  currentRole,
  requiredPermission,
  returnHref = "/dashboard",
  returnLabel = "Return to Authorized Dashboard",
}: PermissionDeniedStateProps) {
  const roleLabel =
    currentRole === "admin"
      ? "Administrator"
      : currentRole === "manager"
        ? "Manager"
        : "Employee";

  return (
    <div
      className="card"
      role="alert"
      aria-live="assertive"
      style={{
        maxWidth: "38rem",
        margin: "2rem auto",
        padding: "2rem",
        borderLeft: "4px solid var(--status-rejected-text)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          marginBottom: "0.75rem",
        }}
      >
        <span className="badge badge-rejected">403 Permission Denied</span>
        <span className="badge badge-neutral">Current Role: {roleLabel}</span>
        {requiredPermission ? (
          <span className="badge badge-neutral font-mono">
            Requires: {requiredPermission}
          </span>
        ) : null}
      </div>

      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          margin: "0 0 0.5rem 0",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h1>

      <p
        style={{
          margin: "0 0 1.25rem 0",
          fontSize: "0.92rem",
          color: "var(--text-secondary)",
          lineHeight: 1.55,
        }}
      >
        {message}
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href={returnHref} className="btn btn-primary">
          {returnLabel}
        </Link>
      </div>
    </div>
  );
}

