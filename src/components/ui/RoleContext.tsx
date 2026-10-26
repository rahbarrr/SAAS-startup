"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { OrgRole } from "@/modules/tenancy/domain";

export interface UserRoleProfile {
  role: OrgRole;
  userName: string;
  userEmail: string | null;
  title: string;
  avatarInitials: string;
}

export interface RoleContextValue {
  currentRole: OrgRole;
  profile: UserRoleProfile;
  isAuthenticated: boolean;
  authenticatedEmail?: string | null;
  authenticatedRole?: OrgRole;
}

const DEFAULT_GUEST_PROFILE: UserRoleProfile = {
  role: "field_employee",
  userName: "Guest User",
  userEmail: null,
  title: "Not signed in",
  avatarInitials: "--",
};

const RoleContext = createContext<RoleContextValue>({
  currentRole: "field_employee",
  profile: DEFAULT_GUEST_PROFILE,
  isAuthenticated: false,
});

export function RoleProvider({
  children,
  authenticatedEmail = null,
  authenticatedRole,
}: {
  children: ReactNode;
  initialRole?: OrgRole;
  authenticatedEmail?: string | null;
  authenticatedRole?: OrgRole;
}) {
  const isAuthenticated = Boolean(authenticatedEmail && authenticatedRole);
  const effectiveRole: OrgRole = authenticatedRole ?? "field_employee";

  const profile = useMemo<UserRoleProfile>(() => {
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

    return DEFAULT_GUEST_PROFILE;
  }, [isAuthenticated, authenticatedEmail, authenticatedRole]);

  return (
    <RoleContext.Provider
      value={{
        currentRole: effectiveRole,
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
