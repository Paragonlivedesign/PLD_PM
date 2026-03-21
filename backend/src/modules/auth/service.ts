import { createHash, randomBytes } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../core/http-error.js";
import * as repo from "./repository.js";
import * as cache from "./cache.js";
import * as jwt from "./jwt.js";
import * as pwd from "./password.js";
import type { UserRow } from "./types.js";
import { isPlatformAdminEmail } from "../platform/privilege.js";

const LOCKOUT_THRESHOLD = Number(process.env.AUTH_LOCKOUT_THRESHOLD ?? "5");
const LOCKOUT_MINUTES = Number(process.env.AUTH_LOCKOUT_MINUTES ?? "15");
const REFRESH_DAYS = 7;
const FORGOT_RATE_MAX = 3;
const FORGOT_RATE_WINDOW_MS = 60 * 60 * 1000;

const forgotAttempts = new Map<string, number[]>();

function forgotRateKey(tenantId: string, email: string): string {
  return `${tenantId}:${email.toLowerCase()}`;
}

function checkForgotRate(tenantId: string, email: string): void {
  const k = forgotRateKey(tenantId, email);
  const now = Date.now();
  const windowStart = now - FORGOT_RATE_WINDOW_MS;
  const list = (forgotAttempts.get(k) ?? []).filter((t) => t > windowStart);
  if (list.length >= FORGOT_RATE_MAX) {
    throw new HttpError(429, "RATE_LIMIT", "Too many reset requests for this email");
  }
  list.push(now);
  forgotAttempts.set(k, list);
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function genOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function toUserProfileResponse(user: UserRow, permissions: string[]) {
  const prefs = user.preferences as {
    timezone?: string | null;
    date_format?: string | null;
    time_format?: "12h" | "24h" | null;
    notification_sound?: boolean;
  };
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    role: user.role_name,
    is_platform_admin: isPlatformAdminEmail(user.email),
    permissions,
    personnel_id: user.personnel_id,
    preferences: {
      timezone: prefs.timezone ?? null,
      date_format: prefs.date_format ?? null,
      time_format: prefs.time_format ?? null,
      notification_sound: prefs.notification_sound ?? true,
    },
    is_active: user.is_active,
    last_login_at: user.last_login_at?.toISOString() ?? null,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };
}

export async function resolvePermissionsForUser(
  tenantId: string,
  userId: string,
  roleId: string,
): Promise<string[]> {
  const hit = await cache.getCachedPermissions(tenantId, userId);
  if (hit) return hit;
  const perms = await repo.listPermissionsForRole(pool, roleId);
  await cache.setCachedPermissions(tenantId, userId, perms);
  return perms;
}

async function issueTokens(user: UserRow): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
}> {
  const permissions = await resolvePermissionsForUser(user.tenant_id, user.id, user.role_id);
  void permissions;
  const access = await jwt.signAccessToken({
    sub: user.id,
    tid: user.tenant_id,
    role: user.role_name,
    pid: user.personnel_id,
  });
  const rawRefresh = genOpaqueToken();
  const refreshHash = hashToken(rawRefresh);
  const familyId = uuidv7();
  const exp = new Date();
  exp.setDate(exp.getDate() + REFRESH_DAYS);
  await repo.insertRefreshToken(
    pool,
    uuidv7(),
    user.tenant_id,
    user.id,
    refreshHash,
    familyId,
    exp,
  );
  return {
    access_token: access,
    refresh_token: rawRefresh,
    expires_in: jwt.accessTokenTtlSeconds(),
    token_type: "Bearer",
  };
}

export async function login(body: {
  email?: string;
  password?: string;
  tenant_slug?: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
  user: ReturnType<typeof toUserProfileResponse>;
}> {
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const tenant_slug = String(body.tenant_slug ?? "").trim();
  if (!email || !password || !tenant_slug) {
    throw new HttpError(400, "VALIDATION", "email, password, and tenant_slug are required");
  }
  const tenant = await repo.findTenantBySlug(pool, tenant_slug);
  if (!tenant?.is_active) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials");
  }
  const user = await repo.findUserByEmail(pool, tenant.id, email);
  if (!user) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials");
  }
  if (!user.is_active) {
    throw new HttpError(403, "FORBIDDEN", "Account disabled");
  }
  if (user.locked_until && user.locked_until > new Date()) {
    throw new HttpError(
      423,
      "LOCKED",
      `Account locked until ${user.locked_until.toISOString()}`,
      "locked_until",
    );
  }
  const okPwd = await pwd.verifyPassword(password, user.password_hash);
  if (!okPwd) {
    await repo.incrementFailedLogin(pool, user.id);
    const fresh = await repo.findUserById(pool, tenant.id, user.id);
    if (fresh && fresh.failed_login_attempts >= LOCKOUT_THRESHOLD) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await repo.lockUser(pool, user.id, until);
    }
    throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials");
  }
  await repo.resetLoginSuccess(pool, user.id);
  const refreshed = await repo.findUserById(pool, tenant.id, user.id);
  if (!refreshed) throw new HttpError(401, "UNAUTHORIZED", "Invalid credentials");
  /** Fresh DB read for permissions (migrations / role_permission edits). */
  await cache.invalidateUserPermissions(refreshed.tenant_id, refreshed.id);
  let tokens: Awaited<ReturnType<typeof issueTokens>>;
  try {
    tokens = await issueTokens(refreshed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "token_error";
    if (msg.includes("JWT") || msg.includes("not configured")) {
      throw new HttpError(503, "SERVICE_UNAVAILABLE", "Authentication service not configured");
    }
    throw e;
  }
  const permissions = await resolvePermissionsForUser(
    refreshed.tenant_id,
    refreshed.id,
    refreshed.role_id,
  );
  return { ...tokens, user: toUserProfileResponse(refreshed, permissions) };
}

export async function refresh(body: { refresh_token?: string }): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: "Bearer";
}> {
  const raw = String(body.refresh_token ?? "");
  if (!raw) throw new HttpError(400, "VALIDATION", "refresh_token is required");
  const h = hashToken(raw);
  const row = await repo.findRefreshByHash(pool, h);
  if (!row) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid refresh token");
  }
  if (row.revoked_at) {
    await repo.revokeRefreshFamily(pool, row.family_id);
    throw new HttpError(401, "UNAUTHORIZED", "Token reuse detected");
  }
  if (row.expires_at < new Date()) {
    throw new HttpError(401, "UNAUTHORIZED", "Refresh token expired");
  }
  const user = await repo.findUserById(pool, row.tenant_id, row.user_id);
  if (!user?.is_active) {
    throw new HttpError(401, "UNAUTHORIZED", "Invalid refresh token");
  }
  await cache.invalidateUserPermissions(user.tenant_id, user.id);
  await repo.revokeRefreshToken(pool, row.id);
  const newRaw = genOpaqueToken();
  const newHash = hashToken(newRaw);
  const exp = new Date();
  exp.setDate(exp.getDate() + REFRESH_DAYS);
  await repo.insertRefreshToken(
    pool,
    uuidv7(),
    row.tenant_id,
    row.user_id,
    newHash,
    row.family_id,
    exp,
  );
  const access = await jwt.signAccessToken({
    sub: user.id,
    tid: user.tenant_id,
    role: user.role_name,
    pid: user.personnel_id,
  });
  return {
    access_token: access,
    refresh_token: newRaw,
    expires_in: jwt.accessTokenTtlSeconds(),
    token_type: "Bearer",
  };
}

export async function logout(body: { refresh_token?: string }): Promise<{ message: string }> {
  const raw = String(body.refresh_token ?? "");
  if (!raw) throw new HttpError(400, "VALIDATION", "refresh_token is required");
  const h = hashToken(raw);
  const row = await repo.findRefreshByHash(pool, h);
  if (row && !row.revoked_at) {
    await cache.invalidateUserPermissions(row.tenant_id, row.user_id);
    await repo.revokeRefreshToken(pool, row.id);
  }
  return { message: "Logged out successfully" };
}

export async function logoutAllSessions(tenantId: string, userId: string): Promise<{ message: string }> {
  await repo.revokeAllUserRefreshTokens(pool, userId);
  await cache.invalidateUserPermissions(tenantId, userId);
  return { message: "All sessions logged out" };
}

export async function revokeUserSessionsAdmin(
  tenantId: string,
  targetUserId: string,
): Promise<{ message: string }> {
  const target = await repo.findUserById(pool, tenantId, targetUserId);
  if (!target) {
    throw new HttpError(404, "NOT_FOUND", "User not found");
  }
  await repo.revokeAllUserRefreshTokens(pool, target.id);
  await cache.invalidateUserPermissions(tenantId, target.id);
  return { message: "Sessions revoked for user" };
}

export async function forgotPassword(body: { email?: string; tenant_slug?: string }): Promise<{
  message: string;
}> {
  const email = String(body.email ?? "").trim();
  const tenant_slug = String(body.tenant_slug ?? "").trim();
  if (!email || !tenant_slug) {
    throw new HttpError(400, "VALIDATION", "email and tenant_slug are required", "email");
  }
  const tenant = await repo.findTenantBySlug(pool, tenant_slug);
  if (!tenant) {
    return {
      message: "If an account exists with this email, a reset link has been sent.",
    };
  }
  checkForgotRate(tenant.id, email);
  const user = await repo.findUserByEmail(pool, tenant.id, email);
  if (user) {
    const raw = genOpaqueToken();
    const tokenHash = hashToken(raw);
    const exp = new Date(Date.now() + 60 * 60 * 1000);
    await repo.insertPasswordResetToken(pool, uuidv7(), user.id, tokenHash, exp);
    // Email delivery: integrate Notifications later; token logged in dev only
    if (process.env.NODE_ENV !== "production") {
      console.info("[auth] password reset token (dev)", { email, token: raw });
    }
  }
  return {
    message: "If an account exists with this email, a reset link has been sent.",
  };
}

export async function resetPassword(body: { token?: string; new_password?: string }): Promise<{
  message: string;
}> {
  const raw = String(body.token ?? "");
  const new_password = String(body.new_password ?? "");
  if (!raw || !new_password) {
    throw new HttpError(400, "VALIDATION", "token and new_password are required");
  }
  try {
    pwd.assertPasswordPolicy(new_password);
  } catch {
    throw new HttpError(400, "VALIDATION", "Password does not meet policy requirements", "new_password");
  }
  const h = hashToken(raw);
  const row = await repo.findPasswordResetByHash(pool, h);
  if (!row || row.used_at || row.expires_at < new Date()) {
    throw new HttpError(401, "UNAUTHORIZED", "Reset token invalid or expired");
  }
  const u = await repo.findUserByIdAnyTenant(pool, row.user_id);
  if (!u) {
    throw new HttpError(401, "UNAUTHORIZED", "Reset token invalid or expired");
  }
  const hash = await pwd.hashPassword(new_password);
  await repo.updateUserPassword(pool, u.id, hash);
  await repo.markPasswordResetUsed(pool, row.id);
  await repo.revokeAllUserRefreshTokens(pool, u.id);
  await cache.invalidateUserPermissions(u.tenant_id, u.id);
  return { message: "Password reset successfully. Please log in with your new password." };
}

export async function getMe(tenantId: string, userId: string) {
  const user = await repo.findUserById(pool, tenantId, userId);
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Unauthenticated");
  const permissions = await resolvePermissionsForUser(tenantId, userId, user.role_id);
  return toUserProfileResponse(user, permissions);
}

export async function updateMe(
  tenantId: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<ReturnType<typeof toUserProfileResponse>> {
  const user = await repo.findUserById(pool, tenantId, userId);
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Unauthenticated");

  const patch: Parameters<typeof repo.updateUserProfile>[3] = {};
  if (body.first_name !== undefined) patch.first_name = String(body.first_name);
  if (body.last_name !== undefined) patch.last_name = String(body.last_name);
  if (body.phone !== undefined) {
    patch.phone = body.phone === null ? null : String(body.phone);
  }
  if (body.preferences !== undefined && typeof body.preferences === "object") {
    patch.preferences = { ...user.preferences, ...(body.preferences as Record<string, unknown>) };
  }

  const currentPassword =
    body.current_password !== undefined ? String(body.current_password) : undefined;
  if (body.email !== undefined) {
    const ne = String(body.email).toLowerCase().trim();
    if (!currentPassword) {
      throw new HttpError(403, "FORBIDDEN", "current_password required to change email", "current_password");
    }
    const okCur = await pwd.verifyPassword(currentPassword, user.password_hash);
    if (!okCur) {
      throw new HttpError(403, "FORBIDDEN", "current_password incorrect", "current_password");
    }
    if (await repo.emailTakenByOtherUser(pool, tenantId, ne, userId)) {
      throw new HttpError(409, "CONFLICT", "Email already in use", "email");
    }
    patch.email = ne;
  }
  if (body.new_password !== undefined) {
    const np = String(body.new_password);
    try {
      pwd.assertPasswordPolicy(np);
    } catch {
      throw new HttpError(400, "VALIDATION", "Password does not meet policy", "new_password");
    }
    const cp =
      body.current_password !== undefined ? String(body.current_password) : undefined;
    if (!cp) {
      throw new HttpError(403, "FORBIDDEN", "current_password required to change password", "current_password");
    }
    const okCur = await pwd.verifyPassword(cp, user.password_hash);
    if (!okCur) {
      throw new HttpError(403, "FORBIDDEN", "current_password incorrect", "current_password");
    }
    const hash = await pwd.hashPassword(np);
    await repo.updateUserPassword(pool, userId, hash);
    await repo.revokeAllUserRefreshTokens(pool, userId);
  }

  const updated =
    Object.keys(patch).length > 0 ? await repo.updateUserProfile(pool, userId, tenantId, patch) : user;
  if (!updated) throw new HttpError(404, "NOT_FOUND", "User not found");
  await cache.invalidateUserPermissions(tenantId, userId);
  const permissions = await resolvePermissionsForUser(tenantId, userId, updated.role_id);
  return toUserProfileResponse(updated, permissions);
}

const INVITE_ROLES = new Set(["admin", "manager", "coordinator", "viewer"]);

export async function inviteUser(
  tenantId: string,
  invitedBy: string,
  body: {
    email?: string;
    role?: string;
    personnel_id?: string;
    expires_in_days?: number;
  },
): Promise<{
  id: string;
  email: string;
  role: string;
  personnel_id: string | null;
  status: "pending";
  invited_by: string;
  expires_at: string;
  accepted_at: null;
  created_at: string;
}> {
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = String(body.role ?? "").trim().toLowerCase();
  if (!email || !role || !INVITE_ROLES.has(role)) {
    throw new HttpError(400, "VALIDATION", "Valid email and role are required");
  }
  const roleRow = await repo.findRoleByName(pool, tenantId, role);
  if (!roleRow) throw new HttpError(400, "VALIDATION", "Invalid role");
  const existing = await repo.findUserByEmail(pool, tenantId, email);
  if (existing) {
    throw new HttpError(409, "CONFLICT", "Email already has an account");
  }
  if (await repo.findPendingInvitationByEmail(pool, tenantId, email)) {
    throw new HttpError(409, "CONFLICT", "Pending invitation exists");
  }
  const personnelId =
    body.personnel_id !== undefined && body.personnel_id !== null
      ? String(body.personnel_id)
      : null;
  const days = Math.min(30, Math.max(1, Number(body.expires_in_days ?? 7) || 7));
  const raw = genOpaqueToken();
  const tokenHash = hashToken(raw);
  const id = uuidv7();
  const exp = new Date();
  exp.setDate(exp.getDate() + days);
  await repo.insertAuthInvitation(pool, {
    id,
    tenantId,
    email,
    roleId: roleRow.id,
    invitedBy,
    personnelId,
    tokenHash,
    expiresAt: exp,
  });
  if (process.env.NODE_ENV !== "production") {
    console.info("[auth] invitation token (dev)", { email, token: raw });
  }
  const now = new Date().toISOString();
  return {
    id,
    email,
    role,
    personnel_id: personnelId,
    status: "pending",
    invited_by: invitedBy,
    expires_at: exp.toISOString(),
    accepted_at: null,
    created_at: now,
  };
}

export async function acceptInvitation(body: {
  token?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: "Bearer"; user: ReturnType<typeof toUserProfileResponse> }> {
  const raw = String(body.token ?? "");
  const password = String(body.password ?? "");
  const first_name = String(body.first_name ?? "").trim() || "User";
  const last_name = String(body.last_name ?? "").trim() || "Name";
  if (!raw || !password) {
    throw new HttpError(400, "VALIDATION", "token and password are required");
  }
  try {
    pwd.assertPasswordPolicy(password);
  } catch {
    throw new HttpError(400, "VALIDATION", "Password does not meet policy", "password");
  }
  const h = hashToken(raw);
  const inv = await repo.findAuthInvitationByTokenHash(pool, h);
  if (!inv || inv.status !== "pending" || inv.expires_at < new Date()) {
    throw new HttpError(400, "VALIDATION", "Invitation invalid or expired");
  }
  const existing = await repo.findUserByEmail(pool, inv.tenant_id, inv.email);
  if (existing) {
    throw new HttpError(409, "CONFLICT", "Account already exists");
  }
  const hash = await pwd.hashPassword(password);
  const userId = uuidv7();
  await repo.insertUser(pool, {
    id: userId,
    tenantId: inv.tenant_id,
    email: inv.email,
    passwordHash: hash,
    roleId: inv.role_id,
    personnelId: inv.personnel_id,
    firstName: first_name,
    lastName: last_name,
  });
  await repo.markInvitationAccepted(pool, inv.id);
  const user = await repo.findUserById(pool, inv.tenant_id, userId);
  if (!user) throw new HttpError(500, "INTERNAL", "Failed to create user");
  const tokens = await issueTokens(user);
  const permissions = await resolvePermissionsForUser(user.tenant_id, user.id, user.role_id);
  return { ...tokens, user: toUserProfileResponse(user, permissions) };
}
