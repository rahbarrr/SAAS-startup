import type { NextRequest } from "next/server";
import { decryptInvitationToken } from "@/modules/auth/invitation-token-vault";
import { sendOrganizationInvitationEmail } from "@/modules/auth/invitation-email";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import { createUserServerSupabaseClient } from "@/lib/supabase/server";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string; invitationId: string }>;
}

export async function POST(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId, invitationId } = await context.params;
    const supabase = await createUserServerSupabaseClient();
    const user = await getAuthenticatedUser(supabase);
    if (!user) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);

    const repository = new SupabaseTenancyRepository(supabase);
    const membership = await repository.getMembershipByUserAndOrg(user.id, orgId);
    if (!membership || membership.status !== "active" || membership.role !== "admin") {
      throw new AppError(
        "FORBIDDEN_ORG_ACCESS",
        "You do not have permission to retry invitation email delivery.",
        403
      );
    }
    const delivery = await repository.claimInvitationEmailDelivery({
      orgId,
      invitationId,
    });
    if (!delivery) {
      throw new AppError(
        "CONFLICT",
        "This invitation is not ready for email retry. It may already be accepted, unavailable, or recently retried.",
        409
      );
    }

    const invitationToken = decryptInvitationToken(delivery.tokenCiphertext);
    if (!invitationToken) {
      await repository.recordInvitationEmailDelivery({
        orgId,
        invitationId,
        delivered: false,
        messageId: null,
        error: "Invitation email retry encryption is not configured safely.",
      });
      throw new AppError(
        "INTERNAL_ERROR",
        "Invitation email retry is not configured safely.",
        503
      );
    }

    const emailDelivery = await sendOrganizationInvitationEmail({
      invitationId,
      recipientEmail: delivery.recipientEmail,
      organizationName: delivery.organizationName,
      role: delivery.role as "manager" | "field_employee",
      invitationToken,
      expiresAt: delivery.expiresAt,
    });
    await repository.recordInvitationEmailDelivery({
      orgId,
      invitationId,
      delivered: emailDelivery.delivered,
      messageId: emailDelivery.messageId,
      error: emailDelivery.error,
    });

    return jsonSuccess({ emailDelivery }, emailDelivery.delivered ? 200 : 502);
  } catch (error) {
    return jsonError(error);
  }
}
