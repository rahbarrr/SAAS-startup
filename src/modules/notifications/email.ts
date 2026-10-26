import "server-only";
import { logger } from "@/lib/observability/logger";
import type { InAppNotification } from "./domain";

export interface EmailDeliveryOptions {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  idempotencyKey: string;
}

export interface EmailDeliveryResult {
  provider: "unconfigured" | "resend" | "smtp";
  delivered: boolean;
  messageId: string | null;
  error: string | null;
  attemptedAt: string;
}

/**
 * Extensible email delivery interface.
 * Implements safe, non-blocking delivery attempts that never leak secrets or PII
 * and never block core workflow transactions if the email transport fails.
 */
export interface EmailDeliveryProvider {
  sendEmail(options: EmailDeliveryOptions): Promise<EmailDeliveryResult>;
}

/**
 * Sanitizes notification data for external email dispatch so sensitive
 * business details, internal tokens, or device GPS coordinates are excluded.
 */
export function buildSafeEmailContent(notification: InAppNotification): {
  subject: string;
  previewText: string;
  textContent: string;
  htmlContent: string;
} {
  const subject = `[FieldTrack] ${notification.title}`;
  const previewText = notification.tripTitleTruncated;
  const textContent = [
    `FieldTrack Notification: ${notification.title}`,
    "",
    notification.message,
    "",
    `Time: ${notification.createdAtUtcLabel}`,
    `Delivery Channel: FieldTrack Workspace In-App Center`,
    "",
    "To view full trip details, log into your FieldTrack operations workspace.",
  ].join("\n");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1b3580; margin-bottom: 8px;">FieldTrack Notification</h2>
      <p style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px;">${notification.title}</p>
      <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-bottom: 20px;">${notification.message}</p>
      <div style="background-color: #f3f4f6; padding: 12px 16px; border-radius: 8px; font-size: 12px; color: #6b7280; margin-bottom: 24px;">
        <span>Logged at: ${notification.createdAtUtcLabel}</span>
      </div>
      <p style="font-size: 12px; color: #9ca3af;">FieldTrack Multi-Tenant Operations Platform. Location snapshots are point-in-time check-in records.</p>
    </div>
  `;

  return { subject, previewText, textContent, htmlContent };
}

/**
 * Default provider implementation when no external email credentials are set in environment.
 * Explicitly records that email delivery is unconfigured, ensuring truth in reporting.
 */
export class UnconfiguredEmailProvider implements EmailDeliveryProvider {
  async sendEmail(options: EmailDeliveryOptions): Promise<EmailDeliveryResult> {
    logger.info(
      "Email delivery skipped: external email provider not configured in environment",
      {
        idempotencyKey: options.idempotencyKey,
        subject: options.subject,
      }
    );

    return {
      provider: "unconfigured",
      delivered: false,
      messageId: null,
      error:
        "No email provider configured (RESEND_API_KEY / SMTP not set). In-app notification persisted.",
      attemptedAt: new Date().toISOString(),
    };
  }
}

/**
 * Safe, isolated email delivery attempt.
 * Guarantees that failures in the email service NEVER throw or abort
 * the parent workflow transaction (e.g., trip approval or submission).
 */
export async function attemptSafeNotificationEmail(params: {
  provider?: EmailDeliveryProvider;
  recipientEmail: string;
  notification: InAppNotification;
}): Promise<EmailDeliveryResult> {
  const provider = params.provider ?? new UnconfiguredEmailProvider();
  const safeContent = buildSafeEmailContent(params.notification);

  try {
    return await provider.sendEmail({
      recipientEmail: params.recipientEmail,
      subject: safeContent.subject,
      textContent: safeContent.textContent,
      htmlContent: safeContent.htmlContent,
      idempotencyKey: `email:${params.notification.auditEventId}`,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown email transport error";
    logger.error("Non-blocking email delivery failure recorded", {
      auditEventId: params.notification.auditEventId,
      error: errorMsg,
    });

    return {
      provider: "unconfigured",
      delivered: false,
      messageId: null,
      error: errorMsg,
      attemptedAt: new Date().toISOString(),
    };
  }
}
