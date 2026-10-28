import { z } from "zod";
import { PLAN_TIERS } from "./domain";

export const billingActionRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkout"),
    planTier: z.enum(["pro", "enterprise"]),
    seatCount: z.coerce.number().int().min(1).max(1000).default(15),
    successPath: z.string().trim().max(240).optional(),
    cancelPath: z.string().trim().max(240).optional(),
  }),
  z.object({
    action: z.literal("portal"),
    returnPath: z.string().trim().max(240).optional(),
  }),
  z.object({
    action: z.literal("update_seats"),
    seatCount: z.coerce.number().int().min(1).max(1000),
    planTier: z.enum(PLAN_TIERS).optional(),
  }),
]);

export type BillingActionRequestInput = z.infer<typeof billingActionRequestSchema>;

export const stripeWebhookEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created: z.number().int().nonnegative(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

export type StripeWebhookEventPayload = z.infer<typeof stripeWebhookEventSchema>;
