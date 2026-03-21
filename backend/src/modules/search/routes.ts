import { Router } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler, requirePermission } from "../../core/middleware.js";
import { getContext } from "../../core/context.js";
import type { Pool } from "pg";
import * as searchSvc from "./service.js";

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(25).optional().default(5),
  include_archived: z.preprocess(
    (v) => v === true || v === "true",
    z.boolean(),
  ).optional().default(false),
});

export function searchRouter(pool: Pool): Router {
  const r = Router();

  r.get(
    "/",
    requirePermission("search:query"),
    asyncHandler(async (req, res) => {
      try {
        const parsed = searchQuerySchema.parse(req.query);
        const ctx = getContext();
        const typesCsv = parsed.type
          ? parsed.type
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null;
        const { results, total_counts, query_time_ms } = await searchSvc.searchUnified(pool, {
          tenantId: ctx.tenantId,
          q: parsed.q,
          types: typesCsv,
          limitPerType: parsed.limit,
          includeArchived: parsed.include_archived ?? false,
        });
        res.json(
          ok(
            { results },
            {
              total_counts,
              query: parsed.q,
              query_time_ms,
            },
          ),
        );
      } catch (e) {
        if (e instanceof ZodError) {
          throw new HttpError(400, "VALIDATION", e.message, undefined);
        }
        throw e;
      }
    }),
  );

  return r;
}
