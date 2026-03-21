import { Router } from "express";
import { ZodError } from "zod";
import { getContext } from "../../core/context.js";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import { asyncHandler, requestContextMiddleware, requirePermission, } from "../../core/middleware.js";
import * as svc from "./financial.service.js";
import { costReportQuerySchema, listInvoicesQuerySchema } from "./schemas.js";
export const financialsRouter = Router();
financialsRouter.use(requestContextMiddleware);
financialsRouter.get("/", asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        const result = await svc.listFinancialRecordsApi(ctx.tenantId, req.query);
        res.status(200).json(ok(result.data, result.meta));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
financialsRouter.post("/", requirePermission("financials:create"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        const row = await svc.createFinancialRecordApi(ctx.tenantId, ctx.userId, req.body);
        res.status(201).json(ok(row));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
financialsRouter.get("/:id", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const row = await svc.getFinancialRecordApi(ctx.tenantId, String(req.params.id));
    res.status(200).json(ok(row));
}));
financialsRouter.put("/:id", requirePermission("financials:update"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        const row = await svc.updateFinancialRecordApi(ctx.tenantId, String(req.params.id), req.body);
        res.status(200).json(ok(row));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
financialsRouter.delete("/:id", requirePermission("financials:delete"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    const data = await svc.deleteFinancialRecordApi(ctx.tenantId, String(req.params.id));
    res.status(200).json(ok(data));
}));
export const invoicesRouter = Router();
invoicesRouter.use(requestContextMiddleware);
invoicesRouter.get("/", asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        listInvoicesQuerySchema.parse(req.query);
        const result = await svc.listInvoicesApi(ctx.tenantId, req.query);
        res.status(200).json(ok(result.data, result.meta));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
invoicesRouter.post("/", requirePermission("invoices:create"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        const row = await svc.createInvoiceApi(ctx.tenantId, ctx.userId, req.body);
        res.status(201).json(ok(row));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
invoicesRouter.get("/:id", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const row = await svc.getInvoiceApi(ctx.tenantId, String(req.params.id));
    res.status(200).json(ok(row));
}));
invoicesRouter.put("/:id", requirePermission("invoices:update"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        const row = await svc.updateInvoiceApi(ctx.tenantId, ctx.userId, String(req.params.id), req.body);
        res.status(200).json(ok(row));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
export const reportsRouter = Router();
reportsRouter.use(requestContextMiddleware);
reportsRouter.get("/costs", requirePermission("reports:read"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        costReportQuerySchema.parse(req.query);
        const result = await svc.costReportApi(ctx.tenantId, req.query);
        res.status(200).json(ok(result.data, result.meta));
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
reportsRouter.get("/costs/export.csv", requirePermission("reports:read"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    try {
        costReportQuerySchema.parse(req.query);
        const csv = await svc.costReportCsvApi(ctx.tenantId, req.query);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="pld-cost-report.csv"');
        res.status(200).send(csv);
    }
    catch (e) {
        if (e instanceof ZodError) {
            throw new HttpError(400, "VALIDATION", e.message);
        }
        throw e;
    }
}));
