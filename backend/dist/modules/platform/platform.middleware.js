import { pool } from "../../db/pool.js";
import * as jwt from "../auth/jwt.js";
import * as repo from "../auth/repository.js";
import { isPlatformAdminEmail } from "./privilege.js";
/**
 * Validates Bearer JWT, loads user (any tenant), checks PLD_PLATFORM_ADMIN_EMAILS.
 * Does not set tenant AsyncLocalStorage — use only on /api/v1/platform routes.
 */
export function platformAdminMiddleware(req, res, next) {
    void (async () => {
        try {
            const authHeader = req.header("authorization");
            const bearer = authHeader?.toLowerCase().startsWith("bearer ") && authHeader.length > 7
                ? authHeader.slice(7).trim()
                : "";
            if (!bearer) {
                res.status(401).json({
                    data: null,
                    meta: null,
                    errors: [{ code: "UNAUTHORIZED", message: "Bearer token required" }],
                });
                return;
            }
            const v = await jwt.validateAccessToken(bearer);
            if (!v.valid || !v.claims) {
                res.status(401).json({
                    data: null,
                    meta: null,
                    errors: [{ code: "UNAUTHORIZED", message: "Invalid or expired access token" }],
                });
                return;
            }
            const user = await repo.findUserByIdAnyTenant(pool, v.claims.sub);
            if (!user?.is_active) {
                res.status(401).json({
                    data: null,
                    meta: null,
                    errors: [{ code: "UNAUTHORIZED", message: "User not found or inactive" }],
                });
                return;
            }
            if (!isPlatformAdminEmail(user.email)) {
                res.status(403).json({
                    data: null,
                    meta: null,
                    errors: [
                        {
                            code: "FORBIDDEN",
                            message: "Platform admin access denied (not in PLD_PLATFORM_ADMIN_EMAILS)",
                        },
                    ],
                });
                return;
            }
            req.platformUserEmail = user.email;
            next();
        }
        catch (e) {
            next(e);
        }
    })();
}
