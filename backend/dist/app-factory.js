import cors from "cors";
import express, { Router } from "express";
import { fail, ok } from "./core/envelope.js";
import { HttpError } from "./core/http-error.js";
import { asyncHandler, requestContextMiddleware } from "./core/middleware.js";
import { correlationIdMiddleware } from "./middleware/correlation-id.js";
import { globalRateLimitMiddleware } from "./middleware/global-rate-limit.js";
import { requestLogMiddleware } from "./middleware/request-log.js";
import { invitationsRouter, personnelRouter } from "./modules/personnel/index.js";
import { departmentsRouter, tenantRouter } from "./modules/tenancy/index.js";
import * as personnelService from "./modules/personnel/personnel.service.js";
import { pool } from "./db/pool.js";
import { customFieldsRouter } from "./modules/custom-fields/index.js";
import { assignmentsRouter } from "./modules/scheduling/routes.js";
import { conflictsRouter } from "./modules/scheduling/conflicts-routes.js";
import { scheduleRouter } from "./modules/scheduling/schedule-routes.js";
import { trucksRouter, truckRoutesRouter } from "./modules/trucks/routes.js";
import { eventFinancialRouter, financialsRouter, invoicesRouter, reportsRouter, } from "./modules/financial/index.js";
import { clientsRouter } from "./modules/clients/routes.js";
import { venuesRouter } from "./modules/venues/routes.js";
import { eventsRouter } from "./modules/events/routes.js";
import { vendorsRouter } from "./modules/vendors/routes.js";
import { meRouter } from "./modules/me/routes.js";
import { payPeriodsRouter, payrollRouter, timeRouter, } from "./modules/time-pay/routes.js";
import { travelRouter } from "./modules/travel/routes.js";
import { documentsRouter, emailDraftsRouter, riderItemsRouter, templatesRouter, } from "./modules/documents/index.js";
import { searchRouter } from "./modules/search/index.js";
import { analyticsDashboardRouter } from "./modules/analytics/index.js";
import { notificationsRouter } from "./modules/collaboration/index.js";
import { authProtectedRouter, authPublicRouter } from "./modules/auth/index.js";
import { auditRouter } from "./modules/audit/index.js";
import { platformRouter } from "./modules/platform/index.js";
import { SHARED_VERSION } from "@pld/shared";
function parseCorsOrigins() {
    const raw = process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5000,http://localhost:5000";
    const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (list.length === 0)
        return "http://localhost:5173";
    if (list.length === 1)
        return list[0];
    return list;
}
export function buildApp() {
    const app = express();
    const corsOrigin = parseCorsOrigins();
    app.use(cors({ origin: corsOrigin, credentials: true }));
    app.use(express.json());
    app.use(correlationIdMiddleware);
    app.use(requestLogMiddleware);
    app.use(globalRateLimitMiddleware);
    const healthPayload = () => ({
        data: { ok: true, shared: SHARED_VERSION },
        meta: {},
        errors: null,
    });
    app.get("/health", (_req, res) => {
        res.json(healthPayload());
    });
    app.get("/api/v1/health", (_req, res) => {
        res.json(healthPayload());
    });
    app.get("/api/v1", (_req, res) => {
        res.json({
            data: { name: "PLD API", version: "0.0.1" },
            meta: {},
            errors: null,
        });
    });
    app.use("/api/v1/auth", authPublicRouter);
    app.use("/api/v1/auth", authProtectedRouter);
    /** Cross-tenant platform admin (Bearer + PLD_PLATFORM_ADMIN_EMAILS); no tenant AsyncLocalStorage */
    app.use("/api/v1/platform", platformRouter);
    app.post("/api/v1/invitations/accept", asyncHandler(async (req, res) => {
        const token = String(req.body?.token ?? "");
        if (!token) {
            throw new HttpError(400, "VALIDATION", "token is required", "token");
        }
        const data = await personnelService.acceptInvitation(token);
        res.status(200).json(ok(data));
    }));
    app.use("/api/v1/events", eventFinancialRouter);
    const apiV1Ctx = Router();
    apiV1Ctx.use(requestContextMiddleware);
    apiV1Ctx.use("/clients", clientsRouter);
    apiV1Ctx.use("/venues", venuesRouter);
    apiV1Ctx.use("/vendors", vendorsRouter);
    apiV1Ctx.use("/events", eventsRouter);
    apiV1Ctx.use("/me", meRouter);
    apiV1Ctx.use("/time", timeRouter);
    apiV1Ctx.use("/pay-periods", payPeriodsRouter);
    apiV1Ctx.use("/payroll", payrollRouter);
    apiV1Ctx.use("/travel", travelRouter);
    apiV1Ctx.use("/search", searchRouter(pool));
    apiV1Ctx.use("/dashboard", analyticsDashboardRouter(pool));
    apiV1Ctx.use("/notifications", notificationsRouter(pool));
    app.use("/api/v1", apiV1Ctx);
    app.use("/api/v1/personnel", personnelRouter);
    app.use("/api/v1/tenant", tenantRouter);
    app.use("/api/v1/departments", departmentsRouter);
    app.use("/api/v1/invitations", invitationsRouter);
    app.use("/api/v1/custom-fields", customFieldsRouter(pool));
    app.use("/api/v1/financials", financialsRouter);
    app.use("/api/v1/invoices", invoicesRouter);
    app.use("/api/v1/reports", reportsRouter);
    app.use("/api/v1/assignments", assignmentsRouter);
    app.use("/api/v1/conflicts", conflictsRouter);
    app.use("/api/v1/schedule", scheduleRouter);
    app.use("/api/v1/trucks", trucksRouter);
    app.use("/api/v1/truck-routes", truckRoutesRouter);
    app.use("/api/v1/documents", documentsRouter);
    app.use("/api/v1/templates", templatesRouter);
    app.use("/api/v1/rider-items", riderItemsRouter);
    app.use("/api/v1/email-drafts", emailDraftsRouter);
    app.use("/api/v1/audit-logs", auditRouter);
    app.use((req, res) => {
        if (!req.path.startsWith("/api")) {
            res.status(404).type("text/plain").send("Not Found");
            return;
        }
        res.status(404).json(fail([
            {
                code: "NOT_FOUND",
                message: `No route for ${req.method} ${req.originalUrl ?? req.url}`,
            },
        ], req.correlationId ? { correlation_id: req.correlationId } : {}));
    });
    app.use((err, req, res, _next) => {
        const meta = req.correlationId ? { correlation_id: req.correlationId } : {};
        if (err instanceof HttpError) {
            res.status(err.status).json(fail([
                {
                    code: err.code,
                    message: err.message,
                    field: err.field,
                    ...(err.details !== undefined ? { details: err.details } : {}),
                },
            ], meta));
            return;
        }
        console.error(err);
        res.status(500).json(fail([{ code: "INTERNAL", message: "Internal server error" }], meta));
    });
    return app;
}
