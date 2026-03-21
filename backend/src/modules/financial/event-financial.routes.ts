import { Router } from "express";
import { ZodError } from "zod";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler, requestContextMiddleware } from "../../core/middleware.js";
import * as svc from "./financial.service.js";
import { listFinancialRecordsQuerySchema } from "./schemas.js";

/**
 * Mounted at `/api/v1/events` — register **before** any catch-all `/:id` router
 * so `/events/:id/budget` and `/events/:id/financials` match.
 */
export const eventFinancialRouter = Router();
eventFinancialRouter.use(requestContextMiddleware);

eventFinancialRouter.get(
  "/:id/budget",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    const result = await svc.getEventBudgetApi(ctx.tenantId, String(req.params.id));
    res.status(200).json(ok(result.data, result.meta));
  }),
);

eventFinancialRouter.get(
  "/:id/financials",
  asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
      listFinancialRecordsQuerySchema.parse(req.query);
      const result = await svc.listEventFinancialsApi(
        ctx.tenantId,
        String(req.params.id),
        req.query,
      );
      res.status(200).json(ok(result.data, result.meta));
    } catch (e) {
      if (e instanceof ZodError) {
        throw new HttpError(400, "VALIDATION", e.message);
      }
      throw e;
    }
  }),
);
