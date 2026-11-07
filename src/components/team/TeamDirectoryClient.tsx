"use client";

import { useRef, useState, type ReactNode, type FormEvent } from "react";
import { AlertCircle, Copy, Search } from "lucide-react";
import { createInFlightActionGuard } from "@/lib/ux/formatting-and-resilience";
import { GoalRingCard } from "@/components/ui/GoalRingCard";
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
  currentUserId?: string;
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
  currentUserId,
}: TeamDirectoryClientProps): ReactNode {
  const { showToast } = useToast();
  const { currentRole } = useCurrentRole();
  const canManage = isAdmin && currentRole === "admin";
  const canInvite = canManage;

  const [members, setMembers] = useState<readonly TeamMemberDisplay[]>(initialMembers);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMemberDisplay | null>(null);
  const [editRole, setEditRole] = useState<OrgRole>("field_employee");
  const [editStatus, setEditStatus] = useState<"active" | "deactivated">("active");
  const [editManagerId, setEditManagerId] = useState<string>("");
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("field_employee");
  const [isInviting, setIsInviting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreatedInviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteActionGuard = useRef(createInFlightActionGuard()).current;

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
    if (!inviteActionGuard.tryAcquire()) return;

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
        ? "The email provider accepted the invitation for delivery."
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
      inviteActionGuard.release();
    }
  }

  function handleCopyInviteLink() {
    if (!createdInvite?.link) return;
    navigator.clipboard.writeText(createdInvite.link);
    showToast("Invitation link copied to clipboard!", "success");
  }

  function openMemberModal(member: TeamMemberDisplay) {
    setSelectedMember(member);
    setEditRole(member.role);
    setEditStatus(member.status === "deactivated" ? "deactivated" : "active");
    setEditManagerId(member.managerUserId ?? "");
    setUpdateError(null);
  }

  async function handleUpdateMember() {
    if (!selectedMember || !canManage) return;
    setIsUpdatingMember(true);
    setUpdateError(null);

    try {
      const res = await fetch(`/api/orgs/${activeOrgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedMember.userId,
          role: editRole,
          status: editStatus,
          managerUserId: editManagerId || null,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        data?: {
          role: OrgRole;
          status: MembershipStatus;
          managerUserId: string | null;
        };
        error?: { message?: string } | string;
      } | null;

      if (!res.ok || !payload?.data) {
        const msg =
          (typeof payload?.error === "object" ? payload.error?.message : null) ??
          "Failed to update member role or status.";
        throw new Error(msg);
      }

      const updatedData = payload.data;
      const managerObj = members.find((m) => m.userId === updatedData.managerUserId);
      const nextTitle =
        updatedData.role === "admin"
          ? "Workspace Administrator"
          : updatedData.role === "manager"
            ? "Operations Manager"
            : "Field Merchandising Representative";

      const updatedMember: TeamMemberDisplay = {
        ...selectedMember,
        role: updatedData.role,
        status: updatedData.status,
        managerUserId: updatedData.managerUserId,
        managerName: managerObj?.name,
        title: nextTitle,
      };

      setMembers((prev) =>
        prev.map((item) => (item.id === updatedMember.id ? updatedMember : item))
      );
      setSelectedMember(updatedMember);
      showToast(`Updated ${selectedMember.name}'s membership & role`, "success");
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "Unable to update member settings."
      );
    } finally {
      setIsUpdatingMember(false);
    }
  }

  const availableManagers = members.filter(
    (m) =>
      (m.role === "admin" || m.role === "manager") &&
      m.status === "active" &&
      m.userId !== selectedMember?.userId
  );

  return (
    <div
      className="mobile-page-stack"
      style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}
    >
      {/* Header section */}
      <section className="page-header" aria-labelledby="team-heading">
        <div className="page-header-text">
          <p className="page-eyebrow">
            {canManage ? "User, Role & Invitation Management" : "Assigned Team Scope"}
          </p>
          <h1 id="team-heading" className="page-title">
            {canManage
              ? "Team Directory, Role & User Management"
              : "Team Directory — Assigned Team Only"}
          </h1>
          <p className="page-subtitle">
            Workspace: <strong>{activeOrgName}</strong> •{" "}
            {canManage
              ? "View all organization employees, invite managers and employees, assign roles, and manage active status."
              : "Operational directory of employees assigned to your team and reporting line."}
          </p>
        </div>

        <div className="page-actions">
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
      <div className="kpi-grid">
        <GoalRingCard
          title="Total Members"
          subtitle="Active team members"
          value={roleCounts.all}
          targetText={`in ${activeOrgName}`}
          percentage={100}
          variant="primary"
          primarySegment={{ label: "Field Reps", value: `${roleCounts.field_employee}` }}
          secondarySegment={{
            label: "Leadership",
            value: `${roleCounts.admin + roleCounts.manager}`,
          }}
        />
        <GoalRingCard
          title="Administrators"
          subtitle="Workspace owners"
          value={roleCounts.admin}
          targetText={`of ${roleCounts.all} members`}
          percentage={
            roleCounts.all > 0 ? Math.round((roleCounts.admin / roleCounts.all) * 100) : 0
          }
          variant="dark"
          primarySegment={{ label: "Admins", value: `${roleCounts.admin}` }}
          secondarySegment={{ label: "Full RLS", value: "Enabled" }}
        />
        <GoalRingCard
          title="Field Managers"
          subtitle="Approval authorities"
          value={roleCounts.manager}
          targetText={`of ${roleCounts.all} members`}
          percentage={
            roleCounts.all > 0 ? Math.round((roleCounts.manager / roleCounts.all) * 100) : 0
          }
          variant="warning"
          primarySegment={{ label: "Managers", value: `${roleCounts.manager}` }}
          secondarySegment={{ label: "Approvers", value: "Verified" }}
        />
        <GoalRingCard
          title="Field Reps"
          subtitle="On-ground operations"
          value={roleCounts.field_employee}
          targetText={`of ${roleCounts.all} members`}
          percentage={
            roleCounts.all > 0
              ? Math.round((roleCounts.field_employee / roleCounts.all) * 100)
              : 0
          }
          variant="success"
          primarySegment={{ label: "Field Reps", value: `${roleCounts.field_employee}` }}
          secondarySegment={{ label: "GPS Ready", value: "60s sync" }}
        />
      </div>

      {/* Filter and Search Bar */}
      <section
        className="filter-bar"
        aria-label="Filter team members by role and keyword"
      >
        <div className="search-input-wrapper">
          <span className="search-icon" aria-hidden="true">
            <Search size={15} />
          </span>
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
                  <td data-label="Member">
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
                  <td data-label="Role">
                    <StatusBadge descriptor={getOrgRoleDescriptor(m.role)} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge descriptor={getMembershipStatusDescriptor(m.status)} />
                  </td>
                  <td data-label="Reporting Manager">
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
                  <td data-label="Joined Date">
                    <span
                      style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}
                    >
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td data-label="Action">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openMemberModal(m)}
                    >
                      {canManage ? "Manage Role / User" : "View Details"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member Profile & Role Management Modal */}
      {selectedMember ? (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMember(null)}
          title={
            canManage
              ? `Manage Member & Role: ${selectedMember.name}`
              : `Member Details: ${selectedMember.name}`
          }
          footer={
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedMember(null)}
                disabled={isUpdatingMember}
              >
                Close
              </button>
              {canManage ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleUpdateMember}
                  disabled={isUpdatingMember}
                >
                  {isUpdatingMember ? "Saving…" : "Save Role & Status"}
                </button>
              ) : null}
            </div>
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
            {updateError ? (
              <div
                className="form-error"
                style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
              >
                <AlertCircle size={14} aria-hidden="true" /> {updateError}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <span className="card-meta">Full name</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>
                  {selectedMember.name}
                </p>
              </div>
              <div>
                <span className="card-meta">Email address</span>
                <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>
                  {selectedMember.email}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
                gap: "1rem",
              }}
            >
              <div>
                <span className="card-meta">Workspace role</span>
                <div style={{ marginTop: "0.25rem" }}>
                  <StatusBadge descriptor={getOrgRoleDescriptor(selectedMember.role)} />
                </div>
              </div>
              <div>
                <span className="card-meta">Membership status</span>
                <div style={{ marginTop: "0.25rem" }}>
                  <StatusBadge
                    descriptor={getMembershipStatusDescriptor(selectedMember.status)}
                  />
                </div>
              </div>
            </div>

            {canManage ? (
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  paddingTop: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                }}
              >
                <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700 }}>
                  Role &amp; Access Controls
                </h4>
                {selectedMember.userId === currentUserId ? (
                  <p className="card-meta" style={{ margin: 0 }}>
                    Security policy: You cannot modify your own role or deactivate your
                    own account.
                  </p>
                ) : null}
                <div className="form-group">
                  <label htmlFor="member-role-select" className="form-label">
                    Assigned Role
                  </label>
                  <select
                    id="member-role-select"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as OrgRole)}
                    className="form-select"
                    disabled={selectedMember.userId === currentUserId}
                  >
                    <option value="admin">Administrator</option>
                    <option value="manager">Manager</option>
                    <option value="field_employee">Employee (Field Rep)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="member-status-select" className="form-label">
                    Account Status
                  </label>
                  <select
                    id="member-status-select"
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as "active" | "deactivated")
                    }
                    className="form-select"
                    disabled={selectedMember.userId === currentUserId}
                  >
                    <option value="active">Active</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="member-manager-select" className="form-label">
                    Reporting Manager
                  </label>
                  <select
                    id="member-manager-select"
                    value={editManagerId}
                    onChange={(e) => setEditManagerId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">No assigned manager</option>
                    {availableManagers.map((mgr) => (
                      <option key={mgr.userId} value={mgr.userId}>
                        {mgr.name} ({mgr.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            <div>
              <span className="card-meta">System user ID</span>
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
                  <Copy size={14} aria-hidden="true" /> Copy Link
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
              {inviteError && (
                <div
                  className="form-error"
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <AlertCircle size={14} aria-hidden="true" /> {inviteError}
                </div>
              )}

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
