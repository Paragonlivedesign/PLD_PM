import type { Request } from "express";
import { UUID_LOOSE_RE } from "../core/uuid-format.js";
import { DEFAULT_TENANT, DEFAULT_USER } from "./context.js";
import { decodeBearerPayload } from "./jwt-payload.js";

export const UUID_RE = UUID_LOOSE_RE;

/**
 * JWT claims override headers. When `PLD_ALLOW_DEFAULT_CONTEXT` is not `0`, missing values fall back to dev defaults.
 */
export function resolveTenantUserIds(req: Request): { tenantId: string; userId: string } | null {
  const payload = decodeBearerPayload(req);
  const tenantFromJwt =
    typeof payload?.tenant_id === "string"
      ? payload.tenant_id.trim()
      : typeof payload?.tid === "string"
        ? payload.tid.trim()
        : "";
  const subFromJwt = typeof payload?.sub === "string" ? payload.sub.trim() : "";
  const tenantHeader = req.header("x-tenant-id")?.trim() ?? req.header("X-Tenant-Id")?.trim() ?? "";
  const userHeader = req.header("x-user-id")?.trim() ?? req.header("X-User-Id")?.trim() ?? "";
  const allowDefault = process.env.PLD_ALLOW_DEFAULT_CONTEXT !== "0";
  const tenantId =
    tenantFromJwt || tenantHeader || (allowDefault ? DEFAULT_TENANT : "");
  const userId = subFromJwt || userHeader || (allowDefault ? DEFAULT_USER : "");
  if (!tenantId || !userId) return null;
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(userId)) return null;
  return { tenantId, userId };
}
