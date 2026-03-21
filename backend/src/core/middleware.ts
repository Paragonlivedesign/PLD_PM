import type { NextFunction, Request, Response } from "express";
import "../middleware/context.js";
import type { RequestContext as DevRequestContext } from "../middleware/context.js";
// DevRequestContext used in bridgeToAsyncLocalStorage
import { resolveTenantUserIds } from "../middleware/resolve-request-identity.js";
import { isTenantUsable, loadActiveTenantRow } from "../middleware/tenant-resolution.js";
import { runWithContext, tryGetContext } from "./context.js";
import { resolveBearerContext } from "../modules/auth/middleware-support.js";

function parsePermissions(header: string | undefined): Set<string> {
  if (!header || header === "*") return new Set(["*"]);
  return new Set(
    header
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function devHeadersAllowed(): boolean {
  return process.env.PLD_DEV_AUTH_HEADERS !== "false";
}

async function attachTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
  tenantId: string,
  userId: string,
  permissions: Set<string>,
): Promise<void> {
  const row = await loadActiveTenantRow(tenantId);
  if (!isTenantUsable(row)) {
    res.status(403).json({
      data: null,
      meta: null,
      errors: [
        {
          code: "TENANT_FORBIDDEN",
          message: "Tenant is missing, suspended, or deactivated",
        },
      ],
    });
    return;
  }
  req.ctx = { tenantId, userId };
  runWithContext({ tenantId, userId, permissions }, () => next());
}

/**
 * JWT Bearer (preferred) or dev headers / defaults (`resolveTenantUserIds`).
 * Disable dev headers with `PLD_DEV_AUTH_HEADERS=false`.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const authHeader = req.header("authorization");
      const bearer =
        authHeader?.toLowerCase().startsWith("bearer ") && authHeader.length > 7
          ? authHeader.slice(7).trim()
          : "";

      if (bearer) {
        const ctx = await resolveBearerContext(bearer);
        if (!ctx) {
          res.status(401).json({
            data: null,
            meta: null,
            errors: [{ code: "UNAUTHORIZED", message: "Invalid or expired access token" }],
          });
          return;
        }
        await attachTenantContext(req, res, next, ctx.tenantId, ctx.userId, ctx.permissions);
        return;
      }

      if (!devHeadersAllowed()) {
        res.status(401).json({
          data: null,
          meta: null,
          errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
        });
        return;
      }

      const ids = resolveTenantUserIds(req);
      if (!ids) {
        res.status(401).json({
          data: null,
          meta: null,
          errors: [
            {
              code: "UNAUTHORIZED",
              message: "Missing X-Tenant-Id or X-User-Id (or send Bearer token)",
            },
          ],
        });
        return;
      }
      const permissions = parsePermissions(req.header("x-permissions"));
      await attachTenantContext(req, res, next, ids.tenantId, ids.userId, permissions);
    } catch (e) {
      next(e);
    }
  })();
}

/** Use after `requestContextMiddleware`. */
export function requirePermission(permission: string) {
  return requireAnyPermission(permission);
}

/** Any listed permission (or `*`) satisfies the check. */
export function requireAnyPermission(...permissions: string[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const ctx = tryGetContext();
    if (!ctx) {
      res.status(500).json({
        data: null,
        meta: null,
        errors: [{ code: "INTERNAL", message: "Missing request context" }],
      });
      return;
    }
    if (ctx.permissions.has("*")) {
      next();
      return;
    }
    const ok = permissions.some((p) => ctx.permissions.has(p));
    if (!ok) {
      res.status(403).json({
        data: null,
        meta: null,
        errors: [
          {
            code: "FORBIDDEN",
            message: `Missing one of: ${permissions.join(", ")}`,
          },
        ],
      });
      return;
    }
    next();
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };
}

/** Use after `middleware/context` `requestContext` — bridges `req.ctx` into AsyncLocalStorage for modules that use `getContext()`. */
export function bridgeToAsyncLocalStorage(req: Request, res: Response, next: NextFunction): void {
  const ctx = (req as Request & { ctx: DevRequestContext }).ctx;
  if (!ctx) {
    res.status(500).json({
      data: null,
      meta: null,
      errors: [{ code: "INTERNAL", message: "Request context not initialized" }],
    });
    return;
  }
  const permissions = parsePermissions(req.header("x-permissions"));
  runWithContext({ tenantId: ctx.tenantId, userId: ctx.userId, permissions }, () => next());
}
