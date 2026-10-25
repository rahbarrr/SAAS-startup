import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { AppError, jsonError, jsonSuccess } from "@/lib/http/envelope";
import {
  createAdminServerSupabaseClient,
  createUserServerSupabaseClient,
} from "@/lib/supabase/server";
import { generateAndDispatchDailyManagerDigestForOrg } from "@/modules/notifications/digest";
import { SupabaseReportingRepository } from "@/modules/reporting/repository";
import { requireOrgPermission, resolveTenantContext } from "@/modules/tenancy/authorization";
import { SupabaseTenancyRepository } from "@/modules/tenancy/repository";

interface RouteContext {
  params: Promise<{ orgId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  try {
    const { orgId } = await context.params;

    const authHeader = request.headers.get("authorization");
    const cronHeader = request.headers.get("x-cron-secret");
    const bearerSecret = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const providedSecret = cronHeader || bearerSecret;

    const configuredCronSecret = process.env.CRON_SECRET?.trim();

    let tenancyRepository: SupabaseTenancyRepository;
    let reportingRepository: SupabaseReportingRepository;

    if (providedSecret) {
      // Scheduler authentication flow
      if (!configuredCronSecret || providedSecret !== configuredCronSecret) {
        throw new AppError(
          "UNAUTHENTICATED",
          "Invalid or missing scheduler authentication secret",
          401
        );
      }

      // Valid cron caller: use service-role / admin client if available, else standard client
      let adminClient;
      try {
        adminClient = createAdminServerSupabaseClient();
      } catch {
        adminClient = await createUserServerSupabaseClient();
      }

      tenancyRepository = new SupabaseTenancyRepository(adminClient);
      reportingRepository = new SupabaseReportingRepository(adminClient);
    } else {
      // Interactive user session flow: verify session cookies and RBAC
      const supabase = await createUserServerSupabaseClient();
      const user = await getAuthenticatedUser(supabase);
      tenancyRepository = new SupabaseTenancyRepository(supabase);
      reportingRepository = new SupabaseReportingRepository(supabase);

      const tenantContext = await resolveTenantContext({
        user,
        candidateOrgId: orgId,
        repository: tenancyRepository,
      });

      // Only managers and admins can trigger or test manager digest
      requireOrgPermission(tenantContext, "visits:review");
    }

    const result = await generateAndDispatchDailyManagerDigestForOrg({
      orgId,
      reportingRepository,
      tenancyRepository,
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    return jsonError(error);
  }
}
