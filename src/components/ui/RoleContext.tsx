"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { OrgRole } from "@/modules/tenancy/domain";

export interface DemoRoleProfile {
  role: OrgRole;
  userName: string;
  userEmail: string;
  title: string;
  avatarInitials: string;
}

export const ROLE_PROFILES: Record<OrgRole, DemoRoleProfile> = {
  admin: {
    role: "admin",
    userName: "Sarah Jenkins",
    userEmail: "sarah.jenkins@apexretail.io",
    title: "Director of Field Operations & Admin",
    avatarInitials: "SJ",
  },
  manager: {
    role: "manager",
    userName: "Marcus Vance",
    userEmail: "marcus.vance@apexretail.io",
    title: "Regional Field Operations Manager",
    avatarInitials: "MV",
  },
  field_employee: {
    role: "field_employee",
    userName: "Elena Rostova",
    userEmail: "elena.rostova@apexretail.io",
    title: "Senior Field Sales & Merchandising Rep",
    avatarInitials: "ER",
  },
};

export interface RoleContextValue {
  currentRole: OrgRole;
  setRole: (role: OrgRole) => void;
  profile: DemoRoleProfile;
  isAuthenticated: boolean;
  authenticatedEmail?: string | null;
  authenticatedRole?: OrgRole;
}

const RoleContext = createContext<RoleContextValue>({
  currentRole: "manager",
  setRole: () => {},
  profile: ROLE_PROFILES.manager,
  isAuthenticated: false,
});

export function RoleProvider({
  children,
  initialRole = "manager",
  authenticatedEmail = null,
  authenticatedRole,
}: {
  children: ReactNode;
  initialRole?: OrgRole;
  authenticatedEmail?: string | null;
  authenticatedRole?: OrgRole;
}) {
  const [role, setRoleState] = useState<OrgRole>(authenticatedRole || initialRole);
  const isAuthenticated = Boolean(authenticatedEmail && authenticatedRole);

  useEffect(() => {
    if (isAuthenticated && authenticatedRole) {
      setRoleState(authenticatedRole);
      return;
    }
    try {
      const saved = localStorage.getItem("fieldtrack_demo_role") as OrgRole;
      if (saved && ROLE_PROFILES[saved]) {
        setRoleState(saved);
      }
    } catch {
      // localStorage may not be accessible in all environments
    }
  }, [isAuthenticated, authenticatedRole]);

  function setRole(newRole: OrgRole) {
    if (isAuthenticated) {
      // In authenticated mode, client-side role switching is locked to prevent unauthorized tampering
      return;
    }
    setRoleState(newRole);
    try {
      localStorage.setItem("fieldtrack_demo_role", newRole);
    } catch {
      // Ignore
    }
  }

  const effectiveRole = isAuthenticated && authenticatedRole ? authenticatedRole : role;

  const profile = useMemo<DemoRoleProfile>(() => {
    if (isAuthenticated && authenticatedEmail && authenticatedRole) {
      const prefix = authenticatedEmail.split("@")[0] || "User";
      const words = prefix.replace(/[._-]/g, " ").split(" ").filter(Boolean);
      const name = words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      const first = words[0] ?? "";
      const second = words[1] ?? "";
      const initials =
        first && second
          ? (first.charAt(0) + second.charAt(0)).toUpperCase()
          : prefix.slice(0, 2).toUpperCase();

      const title =
        authenticatedRole === "admin"
          ? "Workspace Administrator"
          : authenticatedRole === "manager"
          ? "Regional Operations Manager"
          : "Field Merchandising Representative";

      return {
        role: authenticatedRole,
        userName: name || authenticatedEmail,
        userEmail: authenticatedEmail,
        title,
        avatarInitials: initials || "FT",
      };
    }

    return ROLE_PROFILES[effectiveRole] || ROLE_PROFILES.manager;
  }, [isAuthenticated, authenticatedEmail, authenticatedRole, effectiveRole]);

  return (
    <RoleContext.Provider
      value={{
        currentRole: effectiveRole,
        setRole,
        profile,
        isAuthenticated,
        authenticatedEmail,
        authenticatedRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useCurrentRole() {
  return useContext(RoleContext);
}
