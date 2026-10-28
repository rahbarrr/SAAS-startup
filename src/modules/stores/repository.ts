import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppError,
  type CursorPaginationMeta,
  decodeCursor,
  encodeCursor,
  sanitizePostgrestSearchTerm,
} from "@/lib/http/envelope";
import type { DbStoreRow } from "@/types/database";
import type { Store } from "./domain";
import type { CreateStoreInput, ListStoresQuery, UpdateStoreInput } from "./schemas";

export interface PaginatedStoresResult {
  items: Store[];
  pagination: CursorPaginationMeta;
}

export interface StoresRepository {
  listStores(orgId: string, query: ListStoresQuery): Promise<PaginatedStoresResult>;
  getStoreById(orgId: string, storeId: string): Promise<Store | null>;
  getStoresByIds(orgId: string, storeIds: readonly string[]): Promise<Store[]>;
  createStore(orgId: string, input: CreateStoreInput): Promise<Store>;
  updateStore(orgId: string, storeId: string, input: UpdateStoreInput): Promise<Store>;
}

export function mapStoreRow(row: DbStoreRow): Store {
  return {
    id: row.id,
    orgId: row.organization_id,
    name: row.name,
    region: row.region,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateProvince: row.state_province,
    postalCode: row.postal_code,
    countryCode: row.country_code,
    latitude: row.latitude,
    longitude: row.longitude,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseStoresRepository implements StoresRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listStores(
    orgId: string,
    query: ListStoresQuery
  ): Promise<PaginatedStoresResult> {
    const pageSize = query.limit;
    let builder = this.supabase
      .from("stores")
      .select(
        "id, organization_id, name, region, address_line1, address_line2, city, state_province, postal_code, country_code, latitude, longitude, active, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (query.region) {
      builder = builder.eq("region", query.region);
    }
    if (query.active !== undefined) {
      builder = builder.eq("active", query.active);
    }
    if (query.search) {
      const sanitized = sanitizePostgrestSearchTerm(query.search);
      if (sanitized.length > 0) {
        builder = builder.or(
          `name.ilike.%${sanitized}%,city.ilike.%${sanitized}%,region.ilike.%${sanitized}%`
        );
      }
    }
    if (query.cursor) {
      const decoded = decodeCursor(query.cursor);
      builder = builder.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`
      );
    }

    const { data, error } = await builder.returns<DbStoreRow[]>();
    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to list stores", 500);
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map(mapStoreRow);
    const lastItem = items[items.length - 1];

    return {
      items,
      pagination: {
        hasMore,
        limit: pageSize,
        nextCursor:
          hasMore && lastItem
            ? encodeCursor({ createdAt: lastItem.createdAt, id: lastItem.id })
            : null,
      },
    };
  }

  async getStoreById(orgId: string, storeId: string): Promise<Store | null> {
    const { data, error } = await this.supabase
      .from("stores")
      .select(
        "id, organization_id, name, region, address_line1, address_line2, city, state_province, postal_code, country_code, latitude, longitude, active, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .eq("id", storeId)
      .maybeSingle<DbStoreRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to load store", 500);
    }

    return data ? mapStoreRow(data) : null;
  }

  async getStoresByIds(orgId: string, storeIds: readonly string[]): Promise<Store[]> {
    if (storeIds.length === 0) {
      return [];
    }
    const { data, error } = await this.supabase
      .from("stores")
      .select(
        "id, organization_id, name, region, address_line1, address_line2, city, state_province, postal_code, country_code, latitude, longitude, active, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .in("id", [...storeIds])
      .returns<DbStoreRow[]>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to verify stores", 500);
    }

    return (data ?? []).map(mapStoreRow);
  }

  async createStore(orgId: string, input: CreateStoreInput): Promise<Store> {
    const { data, error } = await this.supabase
      .from("stores")
      .insert({
        organization_id: orgId,
        name: input.name,
        region: input.region,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2 ?? null,
        city: input.city,
        state_province: input.stateProvince ?? null,
        postal_code: input.postalCode ?? null,
        country_code: input.countryCode,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        active: true,
      })
      .select(
        "id, organization_id, name, region, address_line1, address_line2, city, state_province, postal_code, country_code, latitude, longitude, active, created_at, updated_at"
      )
      .single<DbStoreRow>();

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("Organization subscription is inactive or expired")) {
        throw new AppError("BILLING_SUBSCRIPTION_INACTIVE", msg, 402);
      }
      if (msg.includes("Plan store limit reached")) {
        throw new AppError("BILLING_PLAN_LIMIT_EXCEEDED", msg, 402);
      }
      throw new AppError("INTERNAL_ERROR", "Failed to create store", 500);
    }

    return mapStoreRow(data);
  }

  async updateStore(
    orgId: string,
    storeId: string,
    input: UpdateStoreInput
  ): Promise<Store> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.region !== undefined) patch.region = input.region;
    if (input.addressLine1 !== undefined) patch.address_line1 = input.addressLine1;
    if (input.addressLine2 !== undefined) patch.address_line2 = input.addressLine2;
    if (input.city !== undefined) patch.city = input.city;
    if (input.stateProvince !== undefined) patch.state_province = input.stateProvince;
    if (input.postalCode !== undefined) patch.postal_code = input.postalCode;
    if (input.countryCode !== undefined) patch.country_code = input.countryCode;
    if (input.latitude !== undefined) patch.latitude = input.latitude;
    if (input.longitude !== undefined) patch.longitude = input.longitude;
    if (input.active !== undefined) patch.active = input.active;

    const { data, error } = await this.supabase
      .from("stores")
      .update(patch)
      .eq("organization_id", orgId)
      .eq("id", storeId)
      .select(
        "id, organization_id, name, region, address_line1, address_line2, city, state_province, postal_code, country_code, latitude, longitude, active, created_at, updated_at"
      )
      .maybeSingle<DbStoreRow>();

    if (error) {
      throw new AppError("INTERNAL_ERROR", "Failed to update store", 500);
    }
    if (!data) {
      throw new AppError(
        "NOT_FOUND",
        "The requested store was not found in your active organization",
        404
      );
    }

    return mapStoreRow(data);
  }
}
