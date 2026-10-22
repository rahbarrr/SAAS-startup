import "server-only";
import { cookies } from "next/headers";

export const ACTIVE_ORG_COOKIE_NAME = "ft_active_org_id";

export async function getActiveOrgCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORG_COOKIE_NAME)?.value ?? null;
}

export async function setActiveOrgCookie(orgId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function clearActiveOrgCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE_NAME);
}
