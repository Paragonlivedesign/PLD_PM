import { pool } from "../../db/pool.js";
import * as jwt from "./jwt.js";
import * as repo from "./repository.js";
import * as svc from "./service.js";

export type ResolvedAuthContext = {
  tenantId: string;
  userId: string;
  permissions: Set<string>;
};

/** Returns null if token invalid or user inactive. */
export async function resolveBearerContext(token: string): Promise<ResolvedAuthContext | null> {
  const v = await jwt.validateAccessToken(token);
  if (!v.valid || !v.claims) return null;
  const user = await repo.findUserById(pool, v.claims.tid, v.claims.sub);
  if (!user?.is_active) return null;
  const perms = await svc.resolvePermissionsForUser(user.tenant_id, user.id, user.role_id);
  return {
    tenantId: user.tenant_id,
    userId: user.id,
    permissions: new Set(perms),
  };
}
