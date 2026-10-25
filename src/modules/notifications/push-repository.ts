import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/http/envelope";
import type {
  WebPushRepository,
  WebPushSubscriptionInput,
  WebPushSubscriptionRecord,
} from "./push";

interface DbWebPushRow {
  id: string;
  organization_id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent: string | null;
  revoked: boolean;
  created_at: string;
  updated_at: string;
}

function mapWebPushRow(row: DbWebPushRow): WebPushSubscriptionRecord {
  return {
    id: row.id,
    orgId: row.organization_id,
    userId: row.user_id,
    endpoint: row.endpoint,
    p256dhKey: row.p256dh_key,
    authKey: row.auth_key,
    userAgent: row.user_agent,
    revoked: row.revoked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseWebPushRepository implements WebPushRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertSubscription(params: {
    orgId: string;
    userId: string;
    input: WebPushSubscriptionInput;
  }): Promise<WebPushSubscriptionRecord> {
    const { data, error } = await this.supabase
      .from("web_push_subscriptions")
      .upsert(
        {
          organization_id: params.orgId,
          user_id: params.userId,
          endpoint: params.input.endpoint,
          p256dh_key: params.input.keys.p256dh,
          auth_key: params.input.keys.auth,
          user_agent: params.input.userAgent ?? null,
          revoked: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,endpoint" }
      )
      .select()
      .single<DbWebPushRow>();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Failed to store web push subscription: ${error?.message ?? "unknown error"}`,
        500
      );
    }

    return mapWebPushRow(data);
  }

  async revokeSubscription(params: {
    orgId: string;
    userId: string;
    endpoint: string;
  }): Promise<boolean> {
    const { error } = await this.supabase
      .from("web_push_subscriptions")
      .update({ revoked: true, updated_at: new Date().toISOString() })
      .eq("organization_id", params.orgId)
      .eq("user_id", params.userId)
      .eq("endpoint", params.endpoint);

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to revoke push subscription", 500);
    }

    return true;
  }

  async listActiveSubscriptionsForUser(
    orgId: string,
    userId: string
  ): Promise<WebPushSubscriptionRecord[]> {
    const { data, error } = await this.supabase
      .from("web_push_subscriptions")
      .select()
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("revoked", false)
      .returns<DbWebPushRow[]>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list push subscriptions", 500);
    }

    return (data ?? []).map(mapWebPushRow);
  }

  async deleteSubscriptionByEndpoint(
    orgId: string,
    userId: string,
    endpoint: string
  ): Promise<void> {
    await this.supabase
      .from("web_push_subscriptions")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
  }
}
