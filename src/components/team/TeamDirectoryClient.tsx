"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import {
  getOrgRoleDescriptor,
  getMembershipStatusDescriptor,
  StatusBadge,
} from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useCurrentRole } from "@/components/ui/RoleContext";
import type { MembershipStatus, OrgRole } from "@/modules/tenancy/domain";

export interface TeamMemberDisplay {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  status: MembershipStatus;
  managerUserId: string | null;
  managerName?: string;
  title: string;
  createdAt: string;
}

export interface TeamDirectoryClientProps {
  initialMembers: readonly TeamMemberDisplay[];
  activeOrgId: string;
  activeOrgName: string;
  isAdmin: boolean;
}

export interface CreatedInviteInfo {
  email: string;
  role: OrgRole;
  token: string;
  link: string;
  emailDelivered: boolean;
  emailStatusMessage: string;
}

export function TeamDirectoryClient({
  initialMembers = [],
  activeOrgId,
  activeOrgName,
  isAdmin,
}: TeamDirectoryClientProps): ReactNode {
  const { showToast } = useToast();
  const { currentRole } = useCurrentRole();
  const canInvite = isAdmin || currentRole === "admin";

  const members = initialMembers;
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMemberDisplay | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("field_employee");
  const [isInviting, setIsInviting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreatedInviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const filteredMembers = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const roleCounts = {
    all: members.length,
    admin: members.filter((m) => m.role === "admin").length,
    manager: members.filter((m) => m.role === "manager").length,
    field_employee: members.filter((m) => m.role === "field_employee").length,
  };

  async function handleInviteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteError(null);

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          expiresInHours: 72,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        data?: {
          invitation: {
            id: string;
            organizationId: string;
            invitedEmail: string;
            role: string;
            expiresAt: string;
          };
          inviteToken: string;
          emailDelivery?: { provider: string; delivered: boolean; error?: string | null };
        };
        error?: { message: string } | string;
        message?: string;
      } | null;

      if (!res.ok || payload?.error || !payload?.data?.inviteToken) {
        const serverError =
          (typeof payload?.error === "object" ? payload?.error?.message : null) ??
          (typeof payload?.message === "string" ? payload.message : null) ??
          (typeof payload?.error === "string" ? payload.error : null) ??
          (res.ok
            ? "Invitation generated, but no invite token was returned by the server."
            : `Failed to generate workspace invitation (HTTP ${res.status}).`);
        throw new Error(serverError);
      }

      const token = payload.data.inviteToken;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${origin}/signup?invite_token=${encodeURIComponent(token)}`;
      const emailDelivered = payload.data.emailDelivery?.delivered === true;
      const emailStatusMessage = emailDelivered
        ? "Resend accepted the invitation email for delivery."
        : (payload.data.emailDelivery?.error ??
          "Automatic email delivery is not configured. Copy the fallback link and send it to the invitee.");

      setCreatedInvite({
        email: inviteEmail.trim(),
        role: inviteRole,
        token,
        link,
        emailDelivered,
        emailStatusMessage,
      });

      showToast(
        emailDelivered
          ? `Invitation email accepted for ${inviteEmail.trim()}`
          : `Invitation created, but email was not sent to ${inviteEmail.trim()}`,
        emailDelivered ? "success" : "error"
      );
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite member.");
    } finally {
      setIsInviting(false);
    }
  }

  function handleCopyInviteLink() {
    if (!createdInvite?.link) return;
    navigator.clipboard.writeText(createdInvite.link);
    showToast("Invitation link copied to clipboard!", "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header section */}
      <section aria-labelledby="team-heading">
        <div className="card-header" style={{ alignItems: "center" }}>
          <div>
            <h1
              id="team-heading"
              style={{
                margin: "0 0 0.25rem",
                fontSize: "1.625rem",
                fontFamily: "var(--font-heading)",
                color: "var(--brand-dark)",
              }}
            >
              Organization Team &amp; Memberships
            </h1>
            <p className="card-meta">
              Workspace: <strong>{activeOrgName}</strong> • Real membership directory,
              role assignments, and member invitations.
            </p>
          </div>

          {canInvite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setInviteError(null);
                setCreatedInvite(null);
                setInviteEmail("");
                setIsInviteOpen(true);
              }}
            >
              + Invite Team Member
            </button>
          )}
        </div>
      </section>

      {/* Role Counts Summary Bar */}
      <div
        className="card-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))" }}
      >
        <div
          className="card"
          style={{
            padding: "0.875rem 1rem",
            borderLeft: "3px solid var(--brand-primary)",
          }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Total Members
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
            }}
          >
            {roleCounts.all}
          </span>
        </div>
        <div
          className="card"
          style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--brand-dark)" }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Administrators
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
            }}
          >
            {roleCounts.admin}
          </span>
        </div>
        <div
          className="card"
          style={{
            padding: "0.875rem 1rem",
            borderLeft: "3px solid var(--brand-accent)",
          }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Field Managers
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
            }}
          >
            {roleCounts.manager}
          </span>
        </div>
        <div
          className="card"
          style={{
            padding: "0.875rem 1rem",
            borderLeft: "3px solid var(--status-success)",
          }}
        >
          <span
            className="card-meta"
            style={{ fontSize: "0.75rem", textTransform: "uppercase" }}
          >
            Field Reps
          </span>
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
            }}
          >
            {roleCounts.field_employee}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <section
        className="filter-bar"
        aria-label="Filter team members by role and keyword"
      >
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, user ID…"
            className="form-input"
            aria-label="Filter team members"
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor="team-role-filter" className="form-label" style={{ margin: 0 }}>
            Role:
          </label>
          <select
            id="team-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="form-select"
            style={{ minWidth: "10rem" }}
          >
            <option value="all">All Roles ({roleCounts.all})</option>
            <option value="admin">Administrators ({roleCounts.admin})</option>
            <option value="manager">Managers ({roleCounts.manager})</option>
            <option value="field_employee">
              Field Reps ({roleCounts.field_employee})
            </option>
          </select>
        </div>
      </section>

      {/* Directory Table / Cards */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          title={
            members.length === 0 ? "No team members yet" : "No matching team members"
          }
          description={
            members.length === 0
              ? "Invite managers and field representatives to collaborate in this workspace."
              : "Try adjusting your search criteria or role filter."
          }
          actionLabel={canInvite ? "+ Invite Member" : undefined}
          onAction={canInvite ? () => setIsInviteOpen(true) : undefined}
        />
      ) : (
        <div className="table-container card">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Reporting Manager</th>
                <th scope="col">Joined Date</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
                    >
                      <div
                        style={{
                          width: "2.25rem",
                          height: "2.25rem",
                          borderRadius: "50%",
                          background: "var(--brand-primary)",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                        }}
                      >
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <strong
                          style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}
                        >
                          {m.name}
                        </strong>
                        <span className="card-meta" style={{ fontSize: "0.75rem" }}>
                          {m.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge descriptor={getOrgRoleDescriptor(m.role)} />
                  </td>
                  <td>
                    <StatusBadge descriptor={getMembershipStatusDescriptor(m.status)} />
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        color: m.managerName
                          ? "var(--text-primary)"
                          : "var(--text-muted)",
                      }}
                    >
                      {m.managerName ?? "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
                    >
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setSelectedMember(m)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member Profile Modal */}
      {selectedMember ? (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMember(null)}
          title={`Member Details: ${selectedMember.name}`}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedMember(null)}
            >
              Close
            </button>
          }
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <span className="card-meta">FULL NAME</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>
                  {selectedMember.name}
                </p>
              </div>
              <div>
                <span className="card-meta">EMAIL ADDRESS</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>
                  {selectedMember.email}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <span className="card-meta">WORKSPACE ROLE</span>
                <div style={{ marginTop: "0.25rem" }}>
                  <StatusBadge descriptor={getOrgRoleDescriptor(selectedMember.role)} />
                </div>
              </div>
              <div>
                <span className="card-meta">MEMBERSHIP STATUS</span>
                <div style={{ marginTop: "0.25rem" }}>
                  <StatusBadge
                    descriptor={getMembershipStatusDescriptor(selectedMember.status)}
                  />
                </div>
              </div>
            </div>

            <div>
              <span className="card-meta">USER ID (SYSTEM)</span>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  fontFamily: "monospace",
                  fontSize: "0.8125rem",
                }}
              >
                {selectedMember.userId}
              </p>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Invite Modal */}
      {isInviteOpen ? (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsInviteOpen(false);
            setCreatedInvite(null);
          }}
          title={
            createdInvite
              ? "Invitation Created Successfully"
              : "Invite Member to Workspace"
          }
          footer={
            createdInvite ? (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsInviteOpen(false);
                    setCreatedInvite(null);
                  }}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCopyInviteLink}
                >
                  📋 Copy Link
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsInviteOpen(false)}
                  disabled={isInviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="invite-member-form"
                  className="btn btn-primary"
                  disabled={isInviting}
                >
                  {isInviting ? "Creating Invitation…" : "Send Invitation"}
                </button>
              </div>
            )
          }
        >
          {createdInvite ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                role="status"
                style={{
                  background: createdInvite.emailDelivered
                    ? "var(--status-success-bg)"
                    : "var(--status-warning-bg, #fffbeb)",
                  border: createdInvite.emailDelivered
                    ? "1px solid var(--status-success-border)"
                    : "1px solid var(--status-warning-border, #f59e0b)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1rem",
                  fontSize: "0.875rem",
                  color: "var(--text-primary)",
                }}
              >
                <strong>
                  {createdInvite.emailDelivered
                    ? "Invitation email accepted for delivery"
                    : "Invitation created, but email was not sent"}
                </strong>
                <p style={{ margin: "0.5rem 0 0" }}>{createdInvite.emailStatusMessage}</p>
                <p style={{ margin: "0.5rem 0 0" }}>
                  Invitee: <strong>{createdInvite.email}</strong> · Role:{" "}
                  <strong>{createdInvite.role}</strong>
                </p>
              </div>

              {!createdInvite.emailDelivered ? (
                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Fallback invitation link (valid for 72 hours):
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      readOnly
                      value={createdInvite.link}
                      className="form-input"
                      style={{ fontFamily: "monospace", fontSize: "0.8125rem" }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCopyInviteLink}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <form
              id="invite-member-form"
              onSubmit={handleInviteSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              {inviteError && <div className="form-error">⚠️ {inviteError}</div>}

              <div className="form-group">
                <label htmlFor="invite-email" className="form-label">
                  Member Email Address *
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="employee@retailcompany.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="invite-role" className="form-label">
                  Workspace Role *
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="form-select"
                >
                  <option value="field_employee">Field Representative</option>
                  <option value="manager">Operations Manager</option>
                </select>
              </div>
            </form>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
