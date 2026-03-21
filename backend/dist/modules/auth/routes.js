import { Router } from "express";
import { asyncHandler, requestContextMiddleware, requirePermission } from "../../core/middleware.js";
import { ok } from "../../core/envelope.js";
import { getContext } from "../../core/context.js";
import * as svc from "./service.js";
export const authPublicRouter = Router();
authPublicRouter.post("/login", asyncHandler(async (req, res) => {
    const data = await svc.login(req.body);
    res.status(200).json(ok(data));
}));
authPublicRouter.post("/refresh", asyncHandler(async (req, res) => {
    const data = await svc.refresh(req.body);
    res.status(200).json(ok(data));
}));
authPublicRouter.post("/forgot-password", asyncHandler(async (req, res) => {
    const data = await svc.forgotPassword(req.body);
    res.status(200).json(ok(data));
}));
authPublicRouter.post("/reset-password", asyncHandler(async (req, res) => {
    const data = await svc.resetPassword(req.body);
    res.status(200).json(ok(data));
}));
authPublicRouter.post("/invitations/accept", asyncHandler(async (req, res) => {
    const data = await svc.acceptInvitation(req.body);
    res.status(200).json(ok(data));
}));
export const authProtectedRouter = Router();
authProtectedRouter.use(requestContextMiddleware);
authProtectedRouter.post("/logout", asyncHandler(async (req, res) => {
    const data = await svc.logout(req.body);
    res.status(200).json(ok(data));
}));
authProtectedRouter.post("/logout-all", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const data = await svc.logoutAllSessions(ctx.tenantId, ctx.userId);
    res.status(200).json(ok(data));
}));
authProtectedRouter.post("/users/:userId/sessions/revoke", requirePermission("auth.sessions.revoke"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    const data = await svc.revokeUserSessionsAdmin(ctx.tenantId, String(req.params.userId ?? ""));
    res.status(200).json(ok(data));
}));
authProtectedRouter.get("/me", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const data = await svc.getMe(ctx.tenantId, ctx.userId);
    res.status(200).json(ok(data));
}));
authProtectedRouter.put("/me", asyncHandler(async (req, res) => {
    const ctx = getContext();
    const data = await svc.updateMe(ctx.tenantId, ctx.userId, req.body);
    res.status(200).json(ok(data));
}));
authProtectedRouter.post("/invite", requirePermission("auth.invitations.manage"), asyncHandler(async (req, res) => {
    const ctx = getContext();
    const data = await svc.inviteUser(ctx.tenantId, ctx.userId, req.body);
    res.status(201).json(ok(data));
}));
