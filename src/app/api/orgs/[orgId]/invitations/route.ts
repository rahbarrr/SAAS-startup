import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { logger } from "@/lib/observability/logger";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";
import { createInvitationForOrg } from "@/modules/tenancy/service";
import { sendOrganizationInvitationEmail } from "@/modules/auth/invitation-email";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  let orgId = "unknown";
  try {
    const params = await context.params;
    orgId = params.orgId;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    const repository = new SupabaseTenancyRepository(supabase);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON", 400);
    }

    logger.info("Processing workspace invitation request", {
      orgId,
      userId: user?.id ?? "unauthenticated",
    });

    const result = await createInvitationForOrg({
      user,
      candidateOrgId: orgId,
      rawInput: body,
      repository,
    });

    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle<{ name: string }>();

    const emailDelivery = await sendOrganizationInvitationEmail({
      invitationId: result.invitation.id,
      recipientEmail: result.invitation.invitedEmail,
      organizationName: organization?.name ?? "your FieldTrack workspace",
      role: result.invitation.role as "manager" | "field_employee",
      invitationToken: result.inviteToken,
      expiresAt: result.invitation.expiresAt,
    });
    await repository.recordInvitationEmailDelivery({
      orgId,
      invitationId: result.invitation.id,
      delivered: emailDelivery.delivered,
      messageId: emailDelivery.messageId,
      error: emailDelivery.error,
    });

    logger.info("Successfully generated workspace invitation", {
      orgId,
      invitationId: result.invitation.id,
      role: result.invitation.role,
      invitedBy: result.invitation.invitedBy,
      expiresAt: result.invitation.expiresAt,
      emailProvider: emailDelivery.provider,
      emailAcceptedByProvider: emailDelivery.delivered,
    });

    // The admin response includes the token as a fallback when email cannot be sent.
    // The persistent invitation record stores only the one-way hash.
    return jsonSuccess({ ...result, emailDelivery }, 201);
  } catch (error) {
    logger.error("Failed to generate workspace invitation", {
      orgId,
      errorCode: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      status: error instanceof AppError ? error.status : 500,
    });
    return jsonError(error);
  }
}
