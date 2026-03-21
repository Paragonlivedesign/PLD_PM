import { pool } from "../../db/pool.js";
import * as jwt from "./jwt.js";
import * as repo from "./repository.js";
import * as cache from "./cache.js";
import * as svc from "./service.js";

export async function validateToken(token: string): Promise<{
  valid: boolean;
  claims: {
    sub: string;
    tid: string;
    role: string;
    pid: string | null;
    exp: number;
  } | null;
  error?: string;
}> {
  const r = await jwt.validateAccessToken(token);
  if (!r.valid) {
    return { valid: false, claims: null, error: r.error };
  }
  return {
    valid: true,
    claims: r.claims,
  };
}

export async function getCurrentUser(userId: string, tenantId: string) {
  const user = await repo.findUserById(pool, tenantId, userId);
  if (!user || !user.is_active) return null;
  const permissions = await svc.resolvePermissionsForUser(tenantId, userId, user.role_id);
  return svc.toUserProfileResponse(user, permissions);
}

export async function resolvePermissions(userId: string, tenantId: string): Promise<string[]> {
  const user = await repo.findUserById(pool, tenantId, userId);
  if (!user || !user.is_active) return [];
  return svc.resolvePermissionsForUser(tenantId, userId, user.role_id);
}

export async function checkPermission(
  userId: string,
  resource: string,
  action: string,
  options?: { resource_id?: string; tenant_id?: string },
): Promise<{ allowed: boolean; reason?: string }> {
  const tenantId = options?.tenant_id;
  if (!tenantId) {
    const user = await repo.findUserByIdAnyTenant(pool, userId);
    if (!user) return { allowed: false, reason: "User not found" };
    return checkPermission(userId, resource, action, { ...options, tenant_id: user.tenant_id });
  }
  const perms = await resolvePermissions(userId, tenantId);
  if (perms.includes("*")) return { allowed: true };
  const key = `${resource}:${action}`;
  if (perms.includes(key)) return { allowed: true };
  return { allowed: false, reason: `Missing permission ${key}` };
}
