import "server-only";
import {
  assertTenantResourceOwnership,
  requireOrgPermission,
  resolveTenantContext,
} from "@/modules/tenancy/authorization";
import type { AuthenticatedUser } from "@/modules/tenancy/domain";
import type { TenancyRepository } from "@/modules/tenancy/repository";
import type { Store } from "./domain";
import type { PaginatedStoresResult, StoresRepository } from "./repository";
import {
  createStoreInputSchema,
  listStoresQuerySchema,
  storeIdParamSchema,
  updateStoreInputSchema,
} from "./schemas";

export async function listStoresForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawQuery: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
}): Promise<PaginatedStoresResult> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "stores:read");

  const query = listStoresQuerySchema.parse(params.rawQuery);
  return params.storesRepository.listStores(context.orgId, query);
}

export async function getStoreForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateStoreId: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
}): Promise<Store> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "stores:read");

  const { storeId } = storeIdParamSchema.parse({
    storeId: params.candidateStoreId,
  });
  const store = await params.storesRepository.getStoreById(context.orgId, storeId);

  return assertTenantResourceOwnership({
    context,
    resource: store,
    requireOwnership: false,
  });
}

export async function createStoreForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
}): Promise<Store> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "stores:write");

  const input = createStoreInputSchema.parse(params.rawInput);
  return params.storesRepository.createStore(context.orgId, input);
}

export async function updateStoreForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateStoreId: unknown;
  rawInput: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
}): Promise<Store> {
  const context = await resolveTenantContext({
    user: params.user,
    candidateOrgId: params.candidateOrgId,
    repository: params.tenancyRepository,
  });

  requireOrgPermission(context, "stores:write");

  const { storeId } = storeIdParamSchema.parse({
    storeId: params.candidateStoreId,
  });
  const existing = await params.storesRepository.getStoreById(context.orgId, storeId);
  assertTenantResourceOwnership({
    context,
    resource: existing,
    requireOwnership: false,
  });

  const input = updateStoreInputSchema.parse(params.rawInput);
  return params.storesRepository.updateStore(context.orgId, storeId, input);
}

export async function archiveStoreForOrg(params: {
  user: AuthenticatedUser | null;
  candidateOrgId: unknown;
  candidateStoreId: unknown;
  tenancyRepository: TenancyRepository;
  storesRepository: StoresRepository;
}): Promise<Store> {
  return updateStoreForOrg({
    ...params,
    rawInput: { active: false },
  });
}
