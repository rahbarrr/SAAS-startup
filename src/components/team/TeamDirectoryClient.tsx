"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { getOrgRoleDescriptor, getMembershipStatusDescriptor, StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useCurrentRole } from "@/components/ui/RoleContext";
import { DEMO_USERS, type DemoUser } from "@/lib/mock-data/fieldtrack-demo-data";
import type { OrgRole } from "@/modules/tenancy/domain";

export interface TeamDirectoryClientProps {
  activeOrgId?: string;
  activeOrgName: string;
  isAdmin: boolean;
}

export interface CreatedInviteInfo {
  name: string;
  email: string;
  role: OrgRole;
  token: string;
  link: string;
}

export function TeamDirectoryClient({ activeOrgId, activeOrgName, isAdmin }: TeamDirectoryClientProps): ReactNode {
  const { showToast } = useToast();
  const { currentRole } = useCurrentRole();
  const canInvite = isAdmin || currentRole === "admin" || currentRole === "manager";

  const [members, setMembers] = useState<DemoUser[]>(DEMO_USERS);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<DemoUser | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("field_employee");
  const [inviteTerritory, setInviteTerritory] = useState("Downtown Central");
  const [isInviting, setIsInviting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreatedInviteInfo | null>(null);

  const filteredMembers = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.territory.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q)
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
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    setIsInviting(true);

    try {
      let token = "";
      if (activeOrgId) {
        const res = await fetch(`/api/orgs/${activeOrgId}/invitations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            role: inviteRole,
            expiresInHours: 72,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data?.error?.message || "Failed to generate workspace invitation.");
        }
        token = data.data.inviteToken;
      } else {
        // Cryptographically random 64-char hex token for demo / preview mode
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        token = Array.from(randomBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${origin}/onboarding?token=${token}`;

      const initials = inviteName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const newMember: DemoUser = {
        id: `usr-inv-${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        territory: inviteTerritory,
        avatarInitials: initials || "TM",
        title:
          inviteRole === "admin"
            ? "Workspace Administrator"
            : inviteRole === "manager"
            ? "Operations Field Manager"
            : "Field Merchandising Representative",
        status: "invited",
      };

      setMembers((prev) => [newMember, ...prev]);
      setCreatedInvite({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        token,
        link,
      });
      showToast(`Invitation generated for ${inviteEmail.trim()}`, "success");
      setIsInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate invitation.";
      showToast(msg, "error");
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Header */}
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
              Organization Team &amp; Directory
            </h1>
            <p className="card-meta">
              Workspace: <strong>{activeOrgName}</strong> • Manage user roles (Admin, Manager, Field Employee) and territorial reporting lines.
            </p>
          </div>
          {canInvite ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsInviteOpen(true)}
            >
              + Invite Team Member
            </button>
          ) : null}
        </div>
      </section>

      {/* Role Summary Stats */}
      <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))" }}>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--brand-dark)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Workspace Admins</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--brand-dark)" }}>{roleCounts.admin}</span>
          <span className="card-meta" style={{ fontSize: "0.75rem" }}>Full security &amp; workspace setup</span>
        </div>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--brand-primary)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Field Managers</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--brand-primary)" }}>{roleCounts.manager}</span>
          <span className="card-meta" style={{ fontSize: "0.75rem" }}>Approvals &amp; territory review</span>
        </div>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--status-success)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Field Representatives</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--status-success)" }}>{roleCounts.field_employee}</span>
          <span className="card-meta" style={{ fontSize: "0.75rem" }}>Store visits &amp; checklist execution</span>
        </div>
        <div className="card" style={{ padding: "0.875rem 1rem", borderLeft: "3px solid var(--brand-accent)" }}>
          <span className="card-meta" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Pending Invitations</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-heading)", color: "var(--brand-accent)" }}>
            {members.filter((m) => m.status === "invited").length}
          </span>
          <span className="card-meta" style={{ fontSize: "0.75rem" }}>Awaiting activation link</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <section className="filter-bar" aria-label="Filter team members by role and name">
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-btn ${roleFilter === "all" ? "active" : ""}`}
            onClick={() => setRoleFilter("all")}
          >
            All Members ({roleCounts.all})
          </button>
          <button
            type="button"
            className={`tab-btn ${roleFilter === "admin" ? "active" : ""}`}
            onClick={() => setRoleFilter("admin")}
          >
            Admins ({roleCounts.admin})
          </button>
          <button
            type="button"
            className={`tab-btn ${roleFilter === "manager" ? "active" : ""}`}
            onClick={() => setRoleFilter("manager")}
          >
            Managers ({roleCounts.manager})
          </button>
          <button
            type="button"
            className={`tab-btn ${roleFilter === "field_employee" ? "active" : ""}`}
            onClick={() => setRoleFilter("field_employee")}
          >
            Field Reps ({roleCounts.field_employee})
          </button>
        </div>

        <div className="search-input-wrapper" style={{ maxWidth: "20rem", marginLeft: "auto" }}>
          <span className="search-icon">🔍</span>
          <input
            id="team-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, territory…"
            className="form-input"
            aria-label="Search team members"
          />
        </div>
      </section>

      {/* Team Member Cards / Directory */}
      {filteredMembers.length === 0 ? (
        <EmptyState
          title="No team members match your filter"
          description="Try selecting another role filter or clearing your search."
          actionLabel="View All Members"
          actionHref="/team"
        />
      ) : (
        <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
          {filteredMembers.map((member) => (
            <article
              key={member.id}
              className="card"
              style={{
                cursor: "pointer",
                borderLeft:
                  member.role === "admin"
                    ? "4px solid var(--brand-dark)"
                    : member.role === "manager"
                    ? "4px solid var(--brand-primary)"
                    : "4px solid var(--status-success)",
              }}
              onClick={() => setSelectedMember(member)}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
                <div
                  style={{
                    width: "2.75rem",
                    height: "2.75rem",
                    borderRadius: "var(--radius-full)",
                    background:
                      member.role === "admin"
                        ? "var(--brand-dark)"
                        : member.role === "manager"
                        ? "var(--brand-primary)"
                        : "var(--status-success)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    flexShrink: 0,
                  }}
                >
                  {member.avatarInitials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <strong style={{ fontSize: "1rem", color: "var(--text-primary)" }}>{member.name}</strong>
                    <StatusBadge descriptor={getMembershipStatusDescriptor(member.status)} />
                  </div>
                  <p className="card-meta text-truncate" style={{ margin: "0.125rem 0 0" }}>
                    {member.email}
                  </p>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.8125rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="card-meta">Role:</span>
                  <StatusBadge descriptor={getOrgRoleDescriptor(member.role)} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="card-meta">Territory:</span>
                  <strong style={{ color: "var(--text-primary)" }}>{member.territory}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="card-meta">Title:</span>
                  <span className="text-truncate" style={{ maxWidth: "12rem", color: "var(--text-secondary)" }}>
                    {member.title}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--brand-primary)", fontWeight: 600 }}>
                  Inspect Member Details →
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Member Details Modal */}
      {selectedMember ? (
        <Modal
          isOpen={true}
          onClose={() => setSelectedMember(null)}
          title={`Member Profile: ${selectedMember.name}`}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: "3.5rem",
                  height: "3.5rem",
                  borderRadius: "var(--radius-full)",
                  background: "var(--brand-primary)",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                }}
              >
                {selectedMember.avatarInitials}
              </div>
              <div>
                <strong style={{ fontSize: "1.125rem" }}>{selectedMember.name}</strong>
                <p className="card-meta" style={{ margin: "0.125rem 0" }}>{selectedMember.email}</p>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <StatusBadge descriptor={getOrgRoleDescriptor(selectedMember.role)} />
                  <StatusBadge descriptor={getMembershipStatusDescriptor(selectedMember.status)} />
                </div>
              </div>
            </div>

            <div style={{ background: "var(--bg-subtle)", padding: "0.875rem", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div>
                <span className="card-meta">OFFICIAL TITLE</span>
                <p style={{ margin: "0.125rem 0 0", fontWeight: 600 }}>{selectedMember.title}</p>
              </div>
              <div>
                <span className="card-meta">ASSIGNED REGION / TERRITORY</span>
                <p style={{ margin: "0.125rem 0 0", fontWeight: 600 }}>{selectedMember.territory}</p>
              </div>
              <div>
                <span className="card-meta">PERMISSIONS &amp; CAPABILITIES</span>
                <p style={{ margin: "0.125rem 0 0", fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  {selectedMember.role === "admin"
                    ? "Full administrative control: invite users, configure stores, manage billing and security policies."
                    : selectedMember.role === "manager"
                    ? "Operations management: review trip itineraries, approve travel requests, inspect visit compliance logs."
                    : "Field operations execution: submit proposed routes, check into assigned stores, complete checklists, upload proof."}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Invite Member Modal */}
      {isInviteOpen ? (
        <Modal
          isOpen={true}
          onClose={() => setIsInviteOpen(false)}
          title="Invite New Team Member"
          footer={
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
                type="button"
                className="btn btn-primary"
                onClick={handleInviteSubmit}
                disabled={isInviting}
              >
                {isInviting ? "Sending Invitation…" : "Send Invitation"}
              </button>
            </div>
          }
        >
          <form onSubmit={handleInviteSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="form-group">
              <label htmlFor="invite-name" className="form-label">
                Full Name *
              </label>
              <input
                id="invite-name"
                type="text"
                className="form-input"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. Rachel Adams"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="invite-email" className="form-label">
                Corporate Email Address *
              </label>
              <input
                id="invite-email"
                type="email"
                className="form-input"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. rachel.adams@apexretail.io"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="invite-role" className="form-label">
                Operational Role *
              </label>
              <select
                id="invite-role"
                className="form-select"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              >
                <option value="field_employee">Field Employee (Store Visits &amp; Checklists)</option>
                <option value="manager">Manager (Approvals, Route Oversight &amp; Reports)</option>
                <option value="admin">Admin (Workspace Admin &amp; System Configuration)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="invite-territory" className="form-label">
                Assigned Territory *
              </label>
              <select
                id="invite-territory"
                className="form-select"
                value={inviteTerritory}
                onChange={(e) => setInviteTerritory(e.target.value)}
              >
                <option value="Downtown Central">Downtown Central</option>
                <option value="North Bay Plaza">North Bay Plaza</option>
                <option value="Eastside Commercial District">Eastside Commercial District</option>
                <option value="West End Corridor">West End Corridor</option>
                <option value="South Industrial Territory">South Industrial Territory</option>
              </select>
            </div>

            <p className="card-meta" style={{ fontSize: "0.75rem", margin: 0 }}>
              An invitation token will be generated and associated with your active workspace organization.
            </p>
          </form>
        </Modal>
      ) : null}

      {/* Invitation Confirmation Modal */}
      {createdInvite ? (
        <Modal
          isOpen={true}
          onClose={() => setCreatedInvite(null)}
          title="Team Member Invitation Generated"
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreatedInvite(null)}
            >
              Done
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.875rem" }}>
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "var(--status-info-bg)",
                border: "1px solid var(--status-info-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <p style={{ margin: 0, color: "var(--brand-dark)", fontWeight: 600 }}>
                Invitation successfully created for <strong>{createdInvite.email}</strong> as{" "}
                <strong style={{ textTransform: "capitalize" }}>{createdInvite.role.replace("_", " ")}</strong>.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Direct Onboarding Link (Valid for 72 Hours)
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  value={createdInvite.link}
                  style={{ fontSize: "0.8125rem", background: "var(--bg-subtle)" }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    navigator.clipboard.writeText(createdInvite.link);
                    showToast("Invitation URL copied to clipboard!", "success");
                  }}
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Secure One-Time Token
              </label>
              <code
                style={{
                  display: "block",
                  padding: "0.5rem 0.75rem",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                }}
              >
                {createdInvite.token}
              </code>
            </div>

            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                background: "var(--bg-surface)",
                padding: "0.625rem",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border-strong)",
              }}
            >
              <strong>Delivery Notice:</strong> In production with Supabase Auth or email integration configured, an automated invite email is dispatched to the recipient. For staging and developer testing, you can share or test the link above directly in an incognito window.
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
