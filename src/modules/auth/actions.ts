"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { clearActiveOrgCookie, setActiveOrgCookie } from "@/lib/auth/active-org-cookie";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, sanitizeErrorMessage } from "@/lib/http/envelope";
import { clientIpFromHeaders, enforceRateLimit } from "@/lib/rate-limit";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import {
  acceptInvitationForCaller,
  createOrganizationForCaller,
  switchActiveOrganizationForCaller,
} from "@/modules/tenancy/service";
import {
  requestPasswordRecoveryForCaller,
  signInCaller,
  signUpPublicCaller,
  SupabaseAuthProvider,
  isTrustedRedirectUrl,
  updatePasswordForCaller,
} from "./service";

export interface ActionState<T = undefined> {
  ok: boolean;
  message?: string;
  error?: string;
  data?: T;
}

function toFriendlyActionError(error: unknown): ActionState<never> {
  if (error instanceof AppError) {
    return {
      ok: false,
      error: sanitizeErrorMessage(error.message),
    };
  }
  return {
    ok: false,
    error: "Please check your input and try again.",
  };
}

export async function signInAction(rawInput: {
  email: string;
  password: string;
}): Promise<ActionState<{ email: string }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const authProvider = new SupabaseAuthProvider(supabase);
    const ip = clientIpFromHeaders(await headers());
    await enforceRateLimit({ supabase, scope: "auth_sign_in", subject: `ip:${ip}` });
    await enforceRateLimit({
      supabase,
      scope: "auth_sign_in",
      subject: `email:${String(rawInput.email).trim().toLowerCase()}`,
    });
    const user = await signInCaller({ rawInput, authProvider });

    const repository = new SupabaseTenancyRepository(supabase);
    const memberships = await repository.listUserOrganizations(user.id);
    const firstActive = memberships[0];
    if (firstActive) {
      await setActiveOrgCookie(firstActive.organization.id);
    }

    revalidatePath("/", "layout");
    return {
      ok: true,
      data: { email: user.email },
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function signUpAction(rawInput: {
  email: string;
  password: string;
  fullName: string;
  inviteToken?: string;
}): Promise<ActionState<{ requiresEmailConfirmation: boolean }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const authProvider = new SupabaseAuthProvider(supabase);
    const ip = clientIpFromHeaders(await headers());
    await enforceRateLimit({ supabase, scope: "auth_sign_up", subject: `ip:${ip}` });

    let redirectToUrl: string | undefined;
    let trustedOrigin: string | undefined;
    const appUrlValue = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const invitationToken =
      typeof rawInput.inviteToken === "string" &&
      /^[A-Za-z0-9_-]{16,256}$/.test(rawInput.inviteToken)
        ? rawInput.inviteToken
        : null;

    if (appUrlValue) {
      const appUrl = new URL(appUrlValue);
      trustedOrigin = appUrl.origin;
      const callbackUrl = new URL("/auth/callback", trustedOrigin);
      const nextUrl = new URL("/onboarding", trustedOrigin);
      if (invitationToken) nextUrl.searchParams.set("token", invitationToken);
      callbackUrl.searchParams.set("next", `${nextUrl.pathname}${nextUrl.search}`);
      redirectToUrl = callbackUrl.toString();
      if (!isTrustedRedirectUrl(redirectToUrl, trustedOrigin)) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Account confirmation redirect is not configured safely",
          400
        );
      }
    } else if (invitationToken) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Email confirmation for invitation links requires NEXT_PUBLIC_APP_URL to be configured.",
        503
      );
    }

    const result = await signUpPublicCaller({
      rawInput: {
        email: rawInput.email,
        password: rawInput.password,
        fullName: rawInput.fullName,
      },
      authProvider,
      redirectToUrl,
      trustedOrigin,
    });

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: result.requiresEmailConfirmation
        ? "Check your email to confirm your account. The link will return you to FieldTrack to finish onboarding."
        : "Account created. You can now create or join an organization.",
      data: {
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      },
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function signOutAction(): Promise<ActionState> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const authProvider = new SupabaseAuthProvider(supabase);
    await authProvider.signOut();
    await clearActiveOrgCookie();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function requestPasswordRecoveryAction(rawInput: {
  email: string;
}): Promise<ActionState> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const authProvider = new SupabaseAuthProvider(supabase);
    const ip = clientIpFromHeaders(await headers());
    await enforceRateLimit({ supabase, scope: "auth_recovery", subject: `ip:${ip}` });
    await enforceRateLimit({
      supabase,
      scope: "auth_recovery",
      subject: `email:${String(rawInput.email).trim().toLowerCase()}`,
    });
    // Origin is server-trusted configuration only; never client-supplied.
    const trustedOrigin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    const result = await requestPasswordRecoveryForCaller({
      rawInput: { email: rawInput.email },
      redirectToUrl: `${trustedOrigin.replace(/\/+$/, "")}/auth/callback?next=/reset-password`,
      trustedOrigin,
      authProvider,
    });

    return {
      ok: true,
      message: result.message,
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function updatePasswordAction(rawInput: {
  password: string;
}): Promise<ActionState> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const authProvider = new SupabaseAuthProvider(supabase);

    const result = await updatePasswordForCaller({
      user,
      rawInput,
      authProvider,
    });

    return {
      ok: true,
      message: result.message,
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function switchActiveOrganizationAction(rawInput: {
  orgId: string;
}): Promise<ActionState<{ orgId: string; orgName: string }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

    const selected = await switchActiveOrganizationForCaller({
      user,
      rawInput,
      repository,
    });

    await setActiveOrgCookie(selected.organization.id);
    revalidatePath("/", "layout");

    return {
      ok: true,
      data: {
        orgId: selected.organization.id,
        orgName: selected.organization.name,
      },
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function onboardOrganizationAction(rawInput: {
  name: string;
  slug: string;
  industry: string;
  companySize: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";
  country: string;
  website?: string;
  phone?: string;
}): Promise<ActionState<{ orgId: string; slug: string }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

    if (!user) {
      throw new AppError(
        "UNAUTHENTICATED",
        "Please sign in before creating a workspace.",
        401
      );
    }

    // Onboarding is only for accounts without a workspace. Keep the check on
    // the server so an existing member cannot create a duplicate workspace by
    // revisiting /onboarding or replaying the form request.
    const existingOrganizations = await repository.listUserOrganizations(user.id);
    if (existingOrganizations.some((entry) => entry.membership.status === "active")) {
      throw new AppError(
        "CONFLICT",
        "Your account already belongs to an active organization. Open that workspace instead.",
        409
      );
    }

    const organization = await createOrganizationForCaller({
      user,
      rawInput,
      repository,
    });

    await setActiveOrgCookie(organization.id);
    revalidatePath("/", "layout");

    return {
      ok: true,
      message: `Organization "${organization.name}" created.`,
      data: {
        orgId: organization.id,
        slug: organization.slug,
      },
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}

export async function acceptInvitationAction(rawInput: {
  token: string;
}): Promise<ActionState<{ orgId: string; role: string }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

    const membership = await acceptInvitationForCaller({
      user,
      rawInput,
      repository,
    });

    await setActiveOrgCookie(membership.orgId);
    revalidatePath("/", "layout");

    return {
      ok: true,
      message: "Invitation accepted. Your organization workspace is now active.",
      data: {
        orgId: membership.orgId,
        role: membership.role,
      },
    };
  } catch (error) {
    return toFriendlyActionError(error);
  }
}
