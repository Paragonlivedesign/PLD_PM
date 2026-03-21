import { runWithContext } from "../core/context.js";
import { UUID_LOOSE_RE } from "../core/uuid-format.js";
import { resolveBearerContext } from "../modules/auth/middleware-support.js";
/** Dev headers until auth middleware exists. */
export const DEFAULT_TENANT = "00000000-0000-0000-0000-000000000001";
export const DEFAULT_USER = "00000000-0000-0000-0000-000000000002";
const uuidRe = UUID_LOOSE_RE;
function devHeadersAllowed() {
    return process.env.PLD_DEV_AUTH_HEADERS !== "false";
}
/**
 * Sets `req.ctx` and AsyncLocalStorage from JWT Bearer or dev headers (defaults).
 */
export function requestContext(req, res, next) {
    void (async () => {
        const authHeader = req.header("authorization");
        const bearer = authHeader?.toLowerCase().startsWith("bearer ") && authHeader.length > 7
            ? authHeader.slice(7).trim()
            : "";
        if (bearer) {
            const resolved = await resolveBearerContext(bearer);
            if (!resolved) {
                res.status(401).json({
                    data: null,
                    meta: null,
                    errors: [{ code: "UNAUTHORIZED", message: "Invalid or expired access token" }],
                });
                return;
            }
            req.ctx = { tenantId: resolved.tenantId, userId: resolved.userId };
            runWithContext({
                tenantId: resolved.tenantId,
                userId: resolved.userId,
                permissions: resolved.permissions,
            }, () => next());
            return;
        }
        const tenantId = (req.header("X-Tenant-Id") ?? DEFAULT_TENANT).trim();
        const userId = (req.header("X-User-Id") ?? DEFAULT_USER).trim();
        if (!devHeadersAllowed()) {
            if (!req.header("X-Tenant-Id")?.trim() || !req.header("X-User-Id")?.trim()) {
                res.status(401).json({
                    data: null,
                    meta: null,
                    errors: [{ code: "UNAUTHORIZED", message: "Authentication required" }],
                });
                return;
            }
        }
        if (!uuidRe.test(tenantId) || !uuidRe.test(userId)) {
            res.status(400).json({
                data: null,
                meta: null,
                errors: [
                    {
                        code: "invalid_context",
                        message: "X-Tenant-Id and X-User-Id must be valid UUIDs",
                    },
                ],
            });
            return;
        }
        req.ctx = { tenantId, userId };
        const permsHeader = req.header("X-Permissions");
        const permissions = !permsHeader || permsHeader === "*"
            ? new Set(["*"])
            : new Set(permsHeader
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean));
        runWithContext({ tenantId, userId, permissions }, () => next());
    })().catch(next);
}
