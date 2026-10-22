import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import {
  type PasswordRecoveryInput,
  passwordRecoveryInputSchema,
  type PasswordUpdateInput,
  passwordUpdateInputSchema,
  type PublicSignUpInput,
  publicSignUpInputSchema,
  type SignInInput,
  signInInputSchema,
} from "./schemas";

export interface AuthProvider {
  signInWithPassword(input: SignInInput): Promise<AuthenticatedUser>;
  signUpWithPassword(
    input: PublicSignUpInput
  ): Promise<{ user: AuthenticatedUser; requiresEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendPasswordRecoveryEmail(
    input: PasswordRecoveryInput,
    redirectToUrl: string
  ): Promise<void>;
  updatePassword(input: PasswordUpdateInput): Promise<void>;
}

export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly supabase: SupabaseClient) {}

  async signInWithPassword(input: SignInInput): Promise<AuthenticatedUser> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.user.email) {
      throw new AppError(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password. Please check your credentials and try again.",
        401
      );
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  }

  async signUpWithPassword(
    input: PublicSignUpInput
  ): Promise<{ user: AuthenticatedUser; requiresEmailConfirmation: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // Only store non-privileged display metadata; never accept org_id or role here
        data: {
          full_name: input.fullName,
        },
      },
    });

    if (error || !data.user || !data.user.email) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Unable to complete registration. Please verify your details and try again.",
        400
      );
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      requiresEmailConfirmation: !data.session,
    };
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Unable to sign out right now. Please try again.",
        500
      );
    }
  }

  async sendPasswordRecoveryEmail(
    input: PasswordRecoveryInput,
    redirectToUrl: string
  ): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(input.email, {
      redirectTo: redirectToUrl,
    });

    if (error) {
      // Do not expose internal auth error details or whether the email exists
      return;
    }
  }

  async updatePassword(input: PasswordUpdateInput): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({
      password: input.password,
    });

    if (error) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Unable to update password. Please ensure your session is active and choose a strong password.",
        400
      );
    }
  }
}

export async function signInCaller(params: {
  rawInput: unknown;
  authProvider: AuthProvider;
}): Promise<AuthenticatedUser> {
  const input = signInInputSchema.parse(params.rawInput);
  return params.authProvider.signInWithPassword(input);
}

/**
 * Registers a public user account.
 * Rejects any request attempting to claim an existing organization or role during public signup.
 */
export async function signUpPublicCaller(params: {
  rawInput: unknown;
  authProvider: AuthProvider;
}): Promise<{ user: AuthenticatedUser; requiresEmailConfirmation: boolean }> {
  const parsed = publicSignUpInputSchema.safeParse(params.rawInput);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid registration input. Public sign-up only accepts email, password, and full name.",
      400
    );
  }
  return params.authProvider.signUpWithPassword(parsed.data);
}

/**
 * Returns true only when `redirectToUrl` is an absolute http(s) URL whose origin
 * exactly matches the trusted application origin (prevents origin poisoning).
 */
export function isTrustedRedirectUrl(
  redirectToUrl: string,
  trustedOrigin: string
): boolean {
  try {
    const target = new URL(redirectToUrl);
    const trusted = new URL(trustedOrigin);
    return (
      (target.protocol === "https:" || target.protocol === "http:") &&
      target.origin === trusted.origin &&
      target.username === "" &&
      target.password === ""
    );
  } catch {
    return false;
  }
}

export async function requestPasswordRecoveryForCaller(params: {
  rawInput: unknown;
  redirectToUrl: string;
  trustedOrigin: string;
  authProvider: AuthProvider;
}): Promise<{ message: string }> {
  if (!isTrustedRedirectUrl(params.redirectToUrl, params.trustedOrigin)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Untrusted password recovery redirect URL",
      400
    );
  }
  const input = passwordRecoveryInputSchema.parse(params.rawInput);
  await params.authProvider.sendPasswordRecoveryEmail(input, params.redirectToUrl);
  return {
    message:
      "If an account exists for that email address, password recovery instructions have been sent.",
  };
}

export async function updatePasswordForCaller(params: {
  user: AuthenticatedUser | null;
  rawInput: unknown;
  authProvider: AuthProvider;
}): Promise<{ message: string }> {
  if (!params.user) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Please sign in or use a valid recovery link to update your password.",
      401
    );
  }

  const input = passwordUpdateInputSchema.parse(params.rawInput);
  await params.authProvider.updatePassword(input);
  return {
    message: "Your password has been updated.",
  };
}
