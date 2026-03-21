import { randomUUID } from "node:crypto";
import { getContext } from "../../core/context.js";
import { HttpError } from "../../core/http-error.js";
import { pool } from "../../core/database.js";
import { getAssignmentsForPersonnelDateRange, getAssignmentsForPersonnelIdsDateRange, hasFutureCrewAssignmentsForPersonnel, } from "../scheduling/personnel-bridge.js";
import { findDepartmentById } from "../tenancy/department.repository.js";
import * as invRepo from "./invitation.repository.js";
import { projectPersonnel } from "./personnel.permissions.js";
import * as pRepo from "./personnel.repository.js";
import { assertEmail, assertEmploymentType, assertPersonnelStatus, parseCsvEnums, } from "./personnel.validator.js";
import { emitPersonnelCreated, emitPersonnelDeactivated, emitPersonnelInvited, emitPersonnelLinkedToUser, emitPersonnelRateChanged, emitPersonnelRoleChanged, emitPersonnelUpdated, } from "./personnel.events.js";
const DEFAULT_CURRENCY = "USD";
export function toPublicPersonnel(row) {
    return row;
}
export function encodeOffsetCursor(offset) {
    return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}
export function decodeOffsetCursor(cursor) {
    if (!cursor)
        return 0;
    try {
        const j = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        return typeof j.o === "number" && j.o >= 0 ? j.o : 0;
    }
    catch {
        return 0;
    }
}
function eachDayInRange(start, end) {
    const out = [];
    const a = new Date(`${start}T00:00:00.000Z`);
    const b = new Date(`${end}T00:00:00.000Z`);
    if (a > b)
        throw new HttpError(400, "VALIDATION", "start must be <= end", "start");
    let guard = 0;
    for (let d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
        out.push(d.toISOString().slice(0, 10));
        guard++;
        if (guard > 400)
            throw new HttpError(400, "VALIDATION", "Date range too large", "end");
    }
    return out;
}
function isDateBlocked(d, blocks) {
    return blocks.some((b) => d >= b.start_date && d <= b.end_date);
}
export async function listPersonnel(query) {
    const ctx = getContext();
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25));
    const offset = decodeOffsetCursor(query.cursor);
    const status = parseCsvEnums(query.status, ["active", "inactive", "on_leave"]);
    const employment_type = parseCsvEnums(query.employment_type, [
        "full_time",
        "part_time",
        "freelance",
        "contractor",
    ]);
    const sortRaw = query.sort_by ?? "name";
    const sortBy = (["name", "role", "department", "created_at"].includes(sortRaw)
        ? sortRaw
        : "name");
    const sortOrder = (query.sort_order ?? "asc");
    const filters = {
        status,
        department_id: query.department_id,
        employment_type,
        role: query.role,
        skill: query.skill,
        search: query.search,
    };
    const total = await pRepo.countPersonnel(pool, ctx.tenantId, filters);
    const rows = await pRepo.listPersonnel(pool, ctx.tenantId, filters, sortBy, sortOrder, offset, limit);
    const data = rows.map((r) => projectPersonnel(toPublicPersonnel(r), ctx.permissions));
    const hasMore = offset + rows.length < total;
    const nextCursor = hasMore ? encodeOffsetCursor(offset + limit) : null;
    return {
        data,
        meta: { cursor: nextCursor, has_more: hasMore, total_count: total },
    };
}
export async function createPersonnel(body) {
    const ctx = getContext();
    const first_name = String(body.first_name ?? "");
    const last_name = String(body.last_name ?? "");
    const email = String(body.email ?? "");
    assertEmail(email);
    if (!first_name || !last_name)
        throw new HttpError(400, "VALIDATION", "Name required");
    const role = String(body.role ?? "");
    if (!role)
        throw new HttpError(400, "VALIDATION", "role required", "role");
    const employment_type = String(body.employment_type ?? "");
    assertEmploymentType(employment_type);
    let status = "active";
    if (body.status !== undefined) {
        assertPersonnelStatus(String(body.status));
        status = String(body.status);
    }
    const department_id = body.department_id ? String(body.department_id) : null;
    if (department_id) {
        const d = await findDepartmentById(pool, ctx.tenantId, department_id, false);
        if (!d)
            throw new HttpError(400, "VALIDATION", "Department not found", "department_id");
    }
    const existing = await pRepo.findPersonnelByEmail(pool, ctx.tenantId, email);
    if (existing)
        throw new HttpError(409, "CONFLICT", "Email already exists", "email");
    const skills = Array.isArray(body.skills) ? body.skills : [];
    const day_rate = body.day_rate !== undefined && body.day_rate !== null ? Number(body.day_rate) : null;
    const per_diem = body.per_diem !== undefined && body.per_diem !== null ? Number(body.per_diem) : null;
    const emergency_contact = body.emergency_contact ?? null;
    const metadata = body.metadata ?? {};
    const id = randomUUID();
    const row = await pRepo.insertPersonnel(pool, {
        id,
        tenant_id: ctx.tenantId,
        user_id: null,
        first_name,
        last_name,
        email,
        phone: body.phone === undefined || body.phone === null ? null : String(body.phone),
        department_id,
        role,
        employment_type,
        skills,
        day_rate_amount: day_rate !== null && !Number.isNaN(day_rate) ? day_rate : null,
        day_rate_currency: DEFAULT_CURRENCY,
        per_diem_amount: per_diem !== null && !Number.isNaN(per_diem) ? per_diem : null,
        per_diem_currency: DEFAULT_CURRENCY,
        status,
        emergency_contact,
        metadata,
    });
    emitPersonnelCreated({
        personnel_id: id,
        tenant_id: ctx.tenantId,
        first_name,
        last_name,
        email,
        role,
        department_id,
        employment_type,
        created_by: ctx.userId,
        created_at: row.created_at,
    });
    return projectPersonnel(toPublicPersonnel(row), ctx.permissions);
}
export async function getPersonnel(id) {
    const ctx = getContext();
    const row = await pRepo.findPersonnelById(pool, ctx.tenantId, id, true);
    if (!row)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    return projectPersonnel(toPublicPersonnel(row), ctx.permissions);
}
export async function updatePersonnel(id, body) {
    const ctx = getContext();
    const existing = await pRepo.findPersonnelById(pool, ctx.tenantId, id, true);
    if (!existing)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    const expectedVersion = body.version !== undefined && body.version !== null ? Number(body.version) : undefined;
    if (expectedVersion !== undefined && expectedVersion !== existing.version) {
        throw new HttpError(409, "CONFLICT", "Optimistic lock conflict", "version");
    }
    const patch = {};
    if (body.first_name !== undefined)
        patch.first_name = body.first_name;
    if (body.last_name !== undefined)
        patch.last_name = body.last_name;
    if (body.email !== undefined) {
        assertEmail(String(body.email));
        patch.email = String(body.email).toLowerCase();
        const other = await pRepo.findPersonnelByEmail(pool, ctx.tenantId, String(body.email));
        if (other && other.id !== id)
            throw new HttpError(409, "CONFLICT", "Email already exists", "email");
    }
    if (body.phone !== undefined)
        patch.phone = body.phone;
    if (body.department_id !== undefined) {
        const did = body.department_id === null ? null : String(body.department_id);
        if (did) {
            const d = await findDepartmentById(pool, ctx.tenantId, did, false);
            if (!d)
                throw new HttpError(400, "VALIDATION", "Department not found", "department_id");
        }
        patch.department_id = did;
    }
    if (body.role !== undefined)
        patch.role = body.role;
    if (body.employment_type !== undefined) {
        assertEmploymentType(String(body.employment_type));
        patch.employment_type = body.employment_type;
    }
    if (body.skills !== undefined)
        patch.skills = body.skills;
    if (body.day_rate !== undefined) {
        const v = body.day_rate === null ? null : Number(body.day_rate);
        patch.day_rate_amount = v;
        patch.day_rate_currency = DEFAULT_CURRENCY;
    }
    if (body.per_diem !== undefined) {
        const v = body.per_diem === null ? null : Number(body.per_diem);
        patch.per_diem_amount = v;
        patch.per_diem_currency = DEFAULT_CURRENCY;
    }
    if (body.status !== undefined) {
        assertPersonnelStatus(String(body.status));
        patch.status = body.status;
    }
    if (body.emergency_contact !== undefined)
        patch.emergency_contact = body.emergency_contact;
    if (body.metadata !== undefined) {
        const merged = { ...existing.metadata, ...body.metadata };
        patch.metadata = merged;
    }
    const changed = Object.keys(patch).filter((k) => k !== "metadata");
    const prev = {};
    const next = {};
    for (const k of Object.keys(patch)) {
        prev[k] = existing[k];
        next[k] = patch[k];
    }
    const updated = await pRepo.updatePersonnel(pool, ctx.tenantId, id, patch, expectedVersion !== undefined ? expectedVersion : undefined);
    if (!updated) {
        throw new HttpError(409, "CONFLICT", "Optimistic lock conflict or not found", "version");
    }
    emitPersonnelUpdated({
        personnel_id: id,
        tenant_id: ctx.tenantId,
        changed_fields: changed,
        previous_values: prev,
        new_values: next,
        updated_by: ctx.userId,
        updated_at: updated.updated_at,
    });
    const rateChanged = ("day_rate_amount" in patch &&
        patch.day_rate_amount !== (existing.day_rate ?? null)) ||
        ("per_diem_amount" in patch &&
            patch.per_diem_amount !== (existing.per_diem ?? null));
    if (rateChanged) {
        emitPersonnelRateChanged({
            personnel_id: id,
            tenant_id: ctx.tenantId,
            old_day_rate: existing.day_rate,
            new_day_rate: updated.day_rate,
            old_per_diem: existing.per_diem,
            new_per_diem: updated.per_diem,
            currency: DEFAULT_CURRENCY,
            updated_by: ctx.userId,
            updated_at: updated.updated_at,
        });
    }
    if ("role" in patch && String(patch.role) !== String(existing.role)) {
        emitPersonnelRoleChanged({
            personnel_id: id,
            tenant_id: ctx.tenantId,
            old_role: existing.role,
            new_role: String(patch.role),
            updated_by: ctx.userId,
            updated_at: updated.updated_at,
        });
    }
    return projectPersonnel(toPublicPersonnel(updated), ctx.permissions);
}
export async function deletePersonnel(id) {
    const ctx = getContext();
    const existing = await pRepo.findPersonnelById(pool, ctx.tenantId, id, true);
    if (!existing)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    const from = new Date().toISOString().slice(0, 10);
    if (await hasFutureCrewAssignmentsForPersonnel(ctx.tenantId, id, from)) {
        throw new HttpError(409, "CONFLICT", "Personnel has active future assignments");
    }
    const out = await pRepo.deactivatePersonnel(pool, ctx.tenantId, id);
    if (!out)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    emitPersonnelDeactivated({
        personnel_id: id,
        tenant_id: ctx.tenantId,
        first_name: existing.first_name,
        last_name: existing.last_name,
        email: existing.email,
        department_id: existing.department_id,
        deactivated_by: ctx.userId,
        deactivated_at: out.deactivated_at,
    });
    return { id: out.id, status: "inactive", deactivated_at: out.deactivated_at };
}
async function availabilityCore(tenantId, personnelId, start, end) {
    const p = await pRepo.findPersonnelById(pool, tenantId, personnelId, true);
    if (!p)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    const days = eachDayInRange(start, end);
    if (days.length > 90) {
        throw new HttpError(400, "VALIDATION", "Maximum 90 days per request", "end");
    }
    const blocks = await pRepo.listBlockedDatesInRange(pool, tenantId, personnelId, start, end);
    const crewDays = await getAssignmentsForPersonnelDateRange(tenantId, personnelId, start, end);
    const byDate = new Map();
    for (const a of crewDays) {
        const list = byDate.get(a.date) ?? [];
        list.push(a);
        byDate.set(a.date, list);
    }
    const outDays = days.map((d) => {
        const blocked = isDateBlocked(d, blocks);
        const asgn = byDate.get(d) ?? [];
        const assignments = asgn.map((x) => ({
            assignment_id: x.assignment_id,
            event_id: x.event_id,
            event_name: x.event_name,
            role: x.role,
        }));
        const available = !blocked && assignments.length === 0;
        return { date: d, available, assignments };
    });
    return {
        personnel_id: personnelId,
        range: { start, end },
        days: outDays,
    };
}
export async function getAvailability(personnelId, start, end) {
    const ctx = getContext();
    return availabilityCore(ctx.tenantId, personnelId, start, end);
}
export async function listBulkAvailability(query) {
    const ctx = getContext();
    const start = String(query.start ?? "");
    const end = String(query.end ?? "");
    if (!start || !end) {
        throw new HttpError(400, "VALIDATION", "start and end are required", "start");
    }
    const days = eachDayInRange(start, end);
    if (days.length > 90) {
        throw new HttpError(400, "VALIDATION", "Maximum 90 days per request", "end");
    }
    const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit ?? "50", 10) || 50));
    const offset = decodeOffsetCursor(query.cursor);
    const statusParsed = parseCsvEnums(query.status, ["active", "inactive", "on_leave"]) ?? [];
    const filters = {
        status: statusParsed.length ? statusParsed : ["active", "on_leave"],
        department_id: query.department_id,
        employment_type: undefined,
        role: undefined,
        skill: undefined,
        search: undefined,
    };
    const total = await pRepo.countPersonnel(pool, ctx.tenantId, filters);
    const rows = await pRepo.listPersonnel(pool, ctx.tenantId, filters, "name", "asc", offset, limit);
    const ids = rows.map((r) => r.id);
    const assignMap = await getAssignmentsForPersonnelIdsDateRange(ctx.tenantId, ids, start, end);
    const blockRows = await pRepo.listBlockedDatesForPersonnelIdsInRange(pool, ctx.tenantId, ids, start, end);
    const blocksByPid = new Map();
    for (const b of blockRows) {
        const list = blocksByPid.get(b.personnel_id) ?? [];
        list.push({ start_date: b.start_date, end_date: b.end_date });
        blocksByPid.set(b.personnel_id, list);
    }
    const data = rows.map((p) => {
        const blocks = blocksByPid.get(p.id) ?? [];
        const crewDays = assignMap.get(p.id) ?? [];
        const byDate = new Map();
        for (const a of crewDays) {
            const list = byDate.get(a.date) ?? [];
            list.push(a);
            byDate.set(a.date, list);
        }
        const outDays = days.map((d) => {
            const blocked = isDateBlocked(d, blocks);
            const asgn = byDate.get(d) ?? [];
            const assignments = asgn.map((x) => ({
                assignment_id: x.assignment_id,
                event_id: x.event_id,
                event_name: x.event_name,
                role: x.role,
            }));
            const available = !blocked && assignments.length === 0;
            return { date: d, available, assignments };
        });
        return {
            personnel_id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            department_id: p.department_id,
            range: { start, end },
            days: outDays,
        };
    });
    const hasMore = offset + rows.length < total;
    return {
        data,
        meta: {
            cursor: hasMore ? encodeOffsetCursor(offset + limit) : null,
            has_more: hasMore,
            total_count: total,
            range: { start, end },
        },
    };
}
export async function createInvitation(body) {
    const ctx = getContext();
    const email = String(body.email ?? "");
    assertEmail(email);
    const first_name = String(body.first_name ?? "");
    const last_name = String(body.last_name ?? "");
    const role = String(body.role ?? "");
    if (!first_name || !last_name || !role) {
        throw new HttpError(400, "VALIDATION", "first_name, last_name, role required");
    }
    let employment_type = null;
    if (body.employment_type !== undefined) {
        assertEmploymentType(String(body.employment_type));
        employment_type = String(body.employment_type);
    }
    const department_id = body.department_id ? String(body.department_id) : null;
    if (department_id) {
        const d = await findDepartmentById(pool, ctx.tenantId, department_id, false);
        if (!d)
            throw new HttpError(400, "VALIDATION", "Department not found", "department_id");
    }
    const expiresInDays = body.expires_in_days !== undefined ? Number(body.expires_in_days) : 7;
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + (Number.isFinite(expiresInDays) ? expiresInDays : 7));
    const token = invRepo.generateInvitationToken();
    const token_hash = invRepo.hashInvitationToken(token);
    const id = randomUUID();
    const inv = await invRepo.insertInvitation(pool, {
        id,
        tenant_id: ctx.tenantId,
        email,
        first_name,
        last_name,
        role,
        department_id,
        employment_type,
        message: body.message === undefined ? null : String(body.message),
        token_hash,
        expires_at: expires,
        invited_by: ctx.userId,
    });
    emitPersonnelInvited({
        invitation_id: inv.id,
        tenant_id: ctx.tenantId,
        email: inv.email,
        first_name: inv.first_name,
        last_name: inv.last_name,
        role: inv.role,
        department_id: inv.department_id,
        invited_by: ctx.userId,
        expires_at: inv.expires_at,
        created_at: inv.created_at,
    });
    return inv;
}
export async function listInvitations(query) {
    const ctx = getContext();
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit ?? "25", 10) || 25));
    const offset = decodeOffsetCursor(query.cursor);
    const status = query.status;
    const total = await invRepo.countInvitations(pool, ctx.tenantId, status);
    const rows = await invRepo.listInvitations(pool, ctx.tenantId, status, offset, limit);
    const hasMore = offset + rows.length < total;
    return {
        data: rows,
        meta: { cursor: hasMore ? encodeOffsetCursor(offset + limit) : null, has_more: hasMore, total_count: total },
    };
}
export async function revokeInvitation(id) {
    const ctx = getContext();
    const out = await invRepo.revokeInvitation(pool, ctx.tenantId, id);
    if (!out)
        throw new HttpError(404, "NOT_FOUND", "Invitation not found or not pending");
    return { id: out.id, status: "revoked", revoked_at: out.revoked_at };
}
export async function acceptInvitation(token) {
    const token_hash = invRepo.hashInvitationToken(token);
    const row = await invRepo.findInvitationByTokenHash(pool, token_hash);
    if (!row)
        throw new HttpError(400, "VALIDATION", "Invalid token");
    if (String(row.status) !== "pending") {
        throw new HttpError(400, "VALIDATION", "Invitation not pending");
    }
    if (new Date(String(row.expires_at)) < new Date()) {
        throw new HttpError(400, "VALIDATION", "Invitation expired");
    }
    const tenantId = String(row.tenant_id);
    const email = String(row.email);
    const existing = await pRepo.findPersonnelByEmail(pool, tenantId, email);
    if (existing) {
        await invRepo.acceptInvitation(pool, String(row.id));
        emitPersonnelLinkedToUser({
            personnel_id: existing.id,
            tenant_id: tenantId,
            invitation_id: String(row.id),
            user_id: null,
            email,
        });
        return { personnel_id: existing.id, invitation_id: String(row.id) };
    }
    const id = randomUUID();
    const employment_type = row.employment_type || "freelance";
    assertEmploymentType(employment_type);
    await pRepo.insertPersonnel(pool, {
        id,
        tenant_id: tenantId,
        user_id: null,
        first_name: String(row.first_name),
        last_name: String(row.last_name),
        email,
        phone: null,
        department_id: row.department_id ? String(row.department_id) : null,
        role: String(row.role),
        employment_type,
        skills: [],
        day_rate_amount: null,
        day_rate_currency: DEFAULT_CURRENCY,
        per_diem_amount: null,
        per_diem_currency: DEFAULT_CURRENCY,
        status: "active",
        emergency_contact: null,
        metadata: {},
    });
    await invRepo.acceptInvitation(pool, String(row.id));
    emitPersonnelLinkedToUser({
        personnel_id: id,
        tenant_id: tenantId,
        invitation_id: String(row.id),
        user_id: null,
        email,
    });
    return { personnel_id: id, invitation_id: String(row.id) };
}
/** Internal — exported from index.ts */
export async function getPersonnelById(personnel_id, tenant_id, options) {
    const row = await pRepo.findPersonnelById(pool, tenant_id, personnel_id, options?.include_deactivated ?? false);
    if (!row)
        return null;
    return toPublicPersonnel(row);
}
export async function getPersonnelByDepartment(department_id, tenant_id, options) {
    const filters = {
        department_id,
        status: options?.status ?? ["active"],
        employment_type: options?.employment_type,
    };
    const rows = await pRepo.listPersonnel(pool, tenant_id, filters, "name", "asc", 0, 10_000);
    return rows.map((r) => toPublicPersonnel(r));
}
/** Internal — documents module template population */
export async function listPersonnelBriefInternal(tenant_id, options) {
    const limit = Math.min(2000, Math.max(1, options?.limit ?? 500));
    const rows = await pRepo.listPersonnel(pool, tenant_id, { status: ["active", "on_leave"] }, "name", "asc", 0, limit);
    return rows.map((r) => ({
        id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        role: r.role,
        email: r.email,
    }));
}
export async function getAvailabilityInternal(personnel_id, tenant_id, start_date, end_date) {
    const a = await availabilityCore(tenant_id, personnel_id, start_date, end_date);
    return {
        personnel_id,
        days: a.days.map((d) => ({
            date: d.date,
            available: d.available,
            assignment_count: d.assignments.length,
        })),
    };
}
export async function getDayRate(personnel_id, tenant_id, _options) {
    const row = await pRepo.findPersonnelById(pool, tenant_id, personnel_id, true);
    if (!row)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    const amt = row.day_rate ?? 0;
    return {
        personnel_id,
        day_rate: amt,
        currency: DEFAULT_CURRENCY,
        is_override: false,
        source: "default",
    };
}
export async function getPerDiem(personnel_id, tenant_id, _options) {
    const row = await pRepo.findPersonnelById(pool, tenant_id, personnel_id, true);
    if (!row)
        throw new HttpError(404, "NOT_FOUND", "Personnel not found");
    const amt = row.per_diem ?? 0;
    return {
        personnel_id,
        per_diem: amt,
        currency: DEFAULT_CURRENCY,
        is_override: false,
    };
}
