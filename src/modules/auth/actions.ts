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
}): Promise<ActionState<{ requiresEmailConfirmation: boolean }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const authProvider = new SupabaseAuthProvider(supabase);
    const ip = clientIpFromHeaders(await headers());
    await enforceRateLimit({ supabase, scope: "auth_sign_up", subject: `ip:${ip}` });
    const result = await signUpPublicCaller({ rawInput, authProvider });

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: result.requiresEmailConfirmation
        ? "Check your email to confirm your account before signing in."
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
}): Promise<ActionState<{ orgId: string; slug: string }>> {
  try {
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

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
