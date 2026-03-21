import type { ConflictResponse } from "@pld/shared";
import { pool } from "../../db/pool.js";
import { getTenantConfig } from "../tenancy/tenancy.service.js";
import { tenantConflictDetectionEnabledResolved } from "../tenancy/tenant-settings.js";
import {
  countConflicts,
  listConflicts,
  mapConflictRow,
  type ListConflictsParams,
} from "./conflicts.repository.js";

export async function listConflictsApi(p: ListConflictsParams): Promise<{
  rows: ConflictResponse[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  conflictDetectionDisabled?: boolean;
}> {
  const cfg = await getTenantConfig(p.tenantId);
  if (!tenantConflictDetectionEnabledResolved(cfg)) {
    return {
      rows: [],
      total: 0,
      nextCursor: null,
      hasMore: false,
      conflictDetectionDisabled: true,
    };
  }
  const { limit: _l, cursorId: _c, ...countParams } = p;
  const total = await countConflicts(pool, countParams);
  const raw = await listConflicts(pool, p);
  const hasMore = raw.length > p.limit;
  const slice = hasMore ? raw.slice(0, p.limit) : raw;
  const nextCursor =
    hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null;
  return {
    rows: slice.map(mapConflictRow),
    total,
    nextCursor,
    hasMore,
  };
}
