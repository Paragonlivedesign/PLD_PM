import { v7 as uuidv7 } from "uuid";
import { pool } from "../../db/pool.js";
import { domainBus } from "../../domain/bus.js";
import * as clientsRepo from "../clients/repository.js";
import * as evRepo from "./repository.js";
import { isValidPhaseTransition } from "./phase.js";
import * as venuesRepo from "../venues/repository.js";
import { validatePrimaryContactForEvent } from "../contacts/event-validation.js";
import { validateCustomFields } from "../custom-fields/service.js";
import { emitEntityCustomFieldsUpdated } from "../../domain/entity-events.js";
import { writeAuditLog } from "../audit/service.js";
export function encodeEventCursor(ev, sortBy) {
    let v;
    switch (sortBy) {
        case "name":
            v = ev.name.toLowerCase();
            break;
        case "start_date":
            v = ev.start_date;
            break;
        case "end_date":
            v = ev.end_date;
            break;
        case "created_at":
            v = ev.created_at;
            break;
        case "updated_at":
            v = ev.updated_at;
            break;
        default:
            v = ev.start_date;
    }
    return Buffer.from(JSON.stringify({ v, id: ev.id, sb: sortBy }), "utf8").toString("base64url");
}
export function decodeEventCursor(raw) {
    if (!raw?.trim())
        return null;
    try {
        const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        const sortKeys = ["name", "start_date", "end_date", "created_at", "updated_at"];
        if (j.v != null &&
            j.id != null &&
            j.sb != null &&
            sortKeys.includes(j.sb)) {
            return { v: j.v, id: j.id, sortBy: j.sb };
        }
    }
    catch {
        return null;
    }
    return null;
}
export async function createEvent(tenantId, userId, body) {
    const cl = await clientsRepo.getClientById(pool, tenantId, body.client_id);
    if (!cl) {
        return { ok: false, code: "not_found", message: "client not found", status: 400 };
    }
    if (body.venue_id) {
        const vn = await venuesRepo.getVenueById(pool, tenantId, body.venue_id);
        if (!vn) {
            return { ok: false, code: "not_found", message: "venue not found", status: 400 };
        }
    }
    const primaryContactId = body.primary_contact_id ?? null;
    if (primaryContactId) {
        const perr = await validatePrimaryContactForEvent(pool, tenantId, primaryContactId, body.client_id, body.venue_id ?? null);
        if (perr) {
            return { ok: false, code: "validation", message: perr, status: 400 };
        }
    }
    const dup = await evRepo.findDuplicateEvent(pool, tenantId, body.client_id, body.name, body.start_date, body.end_date);
    if (dup) {
        return {
            ok: false,
            code: "duplicate",
            message: "Duplicate event name for the same client + date range",
            status: 409,
        };
    }
    const id = uuidv7();
    const status = body.status ?? "draft";
    const phase = body.phase ?? "planning";
    const rawCf = body.custom_fields ?? {};
    const cfCheck = await validateCustomFields(pool, "event", tenantId, rawCf);
    if (!cfCheck.valid) {
        const first = cfCheck.errors[0];
        return {
            ok: false,
            code: first?.code ?? "custom_fields_invalid",
            message: first?.message ?? "Invalid custom fields",
            status: 400,
        };
    }
    const event = await evRepo.insertEvent(pool, {
        id,
        tenantId,
        name: body.name,
        clientId: body.client_id,
        venueId: body.venue_id ?? null,
        primaryContactId,
        startDate: body.start_date,
        endDate: body.end_date,
        loadIn: body.load_in_date ?? null,
        loadOut: body.load_out_date ?? null,
        status,
        phase,
        description: body.description ?? null,
        tags: body.tags ?? [],
        metadata: body.metadata ?? {},
        customFields: cfCheck.cleaned_values,
        createdBy: userId,
    });
    emitEntityCustomFieldsUpdated({ tenantId, entityType: "event", entityId: event.id });
    domainBus.emit("event.created", {
        event_id: event.id,
        tenant_id: tenantId,
        name: event.name,
        client_id: event.client_id,
        venue_id: event.venue_id,
        start_date: event.start_date,
        end_date: event.end_date,
        status: event.status,
        phase: event.phase,
        created_by: userId,
        created_at: event.created_at,
    });
    void writeAuditLog(pool, {
        tenantId,
        userId,
        entityType: "event",
        entityId: event.id,
        action: "create",
        changes: { after: { name: event.name, client_id: event.client_id } },
    }).catch(() => undefined);
    return { ok: true, event };
}
export async function listEventsQuery(tenantId, q) {
    const sortBy = q.sort_by ?? "start_date";
    const sortOrder = q.sort_order ?? "asc";
    const limit = q.limit ?? 25;
    const dec = decodeEventCursor(q.cursor);
    const cursorVal = dec && dec.sortBy === sortBy ? dec.v : null;
    const cursorId = dec && dec.sortBy === sortBy ? dec.id : null;
    const status = q.status
        ? q.status.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const phase = q.phase
        ? q.phase.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    const p = {
        tenantId,
        status,
        phase,
        clientId: q.client_id,
        venueId: q.venue_id,
        dateRangeStart: q.date_range_start,
        dateRangeEnd: q.date_range_end,
        search: q.search,
        sortBy,
        sortOrder,
        limit: limit + 1,
        cursorVal,
        cursorId,
    };
    const total = await evRepo.countEvents(pool, {
        tenantId,
        status,
        phase,
        clientId: q.client_id,
        venueId: q.venue_id,
        dateRangeStart: q.date_range_start,
        dateRangeEnd: q.date_range_end,
        search: q.search,
    });
    const rows = await evRepo.listEvents(pool, p);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeEventCursor(last, sortBy) : null;
    return { rows: page, total, nextCursor };
}
export async function getEvent(tenantId, id) {
    return evRepo.getEventById(pool, tenantId, id);
}
export async function updateEvent(tenantId, userId, id, body) {
    const existing = await evRepo.getEventById(pool, tenantId, id);
    if (!existing) {
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    if (body.client_id) {
        const cl = await clientsRepo.getClientById(pool, tenantId, body.client_id);
        if (!cl) {
            return { ok: false, code: "not_found", message: "client not found", status: 400 };
        }
    }
    if (body.venue_id !== undefined && body.venue_id !== null) {
        const vn = await venuesRepo.getVenueById(pool, tenantId, body.venue_id);
        if (!vn) {
            return { ok: false, code: "not_found", message: "venue not found", status: 400 };
        }
    }
    const nextClientId = typeof body.client_id === "string" ? body.client_id : existing.client_id;
    const nextVenueId = body.venue_id !== undefined ? body.venue_id : existing.venue_id;
    const effectivePrimaryContactId = body.primary_contact_id !== undefined
        ? body.primary_contact_id
        : existing.primary_contact_id;
    if (effectivePrimaryContactId) {
        const perr = await validatePrimaryContactForEvent(pool, tenantId, effectivePrimaryContactId, nextClientId, nextVenueId);
        if (perr) {
            return {
                ok: false,
                code: "validation",
                message: perr,
                status: 400,
                field: "primary_contact_id",
            };
        }
    }
    const expected = body.updated_at;
    const patch = { ...body };
    delete patch.updated_at;
    if (patch.custom_fields !== undefined) {
        const merged = {
            ...existing.custom_fields,
            ...patch.custom_fields,
        };
        const cfCheck = await validateCustomFields(pool, "event", tenantId, merged);
        if (!cfCheck.valid) {
            const first = cfCheck.errors[0];
            return {
                ok: false,
                code: first?.code ?? "custom_fields_invalid",
                message: first?.message ?? "Invalid custom fields",
                status: 400,
                field: "custom_fields",
            };
        }
        patch.custom_fields = cfCheck.cleaned_values;
    }
    const start = patch.start_date ?? existing.start_date;
    const end = patch.end_date ?? existing.end_date;
    if (patch.name || patch.start_date || patch.end_date) {
        const dup = await evRepo.findDuplicateEvent(pool, tenantId, patch.client_id ?? existing.client_id, patch.name ?? existing.name, start, end, id);
        if (dup) {
            return {
                ok: false,
                code: "duplicate",
                message: "Duplicate event name for the same client + date range",
                status: 409,
            };
        }
    }
    const prev = {};
    for (const k of Object.keys(patch)) {
        if (k in existing) {
            prev[k] = existing[k];
        }
    }
    const updated = await evRepo.updateEventRow(pool, tenantId, id, patch, expected);
    if (!updated) {
        if (expected) {
            return {
                ok: false,
                code: "conflict",
                message: "Conflicting update (stale updated_at)",
                status: 409,
            };
        }
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    domainBus.emit("event.updated", {
        event_id: id,
        tenant_id: tenantId,
        changed_fields: Object.keys(patch),
        previous_values: prev,
        new_values: patch,
        updated_by: userId,
        updated_at: updated.updated_at,
    });
    if (patch.start_date !== undefined || patch.end_date !== undefined) {
        domainBus.emit("event.datesChanged", {
            event_id: id,
            tenant_id: tenantId,
            old_start_date: existing.start_date,
            old_end_date: existing.end_date,
            new_start_date: updated.start_date,
            new_end_date: updated.end_date,
        });
    }
    return { ok: true, event: updated };
}
export async function deleteEvent(tenantId, userId, id) {
    const existing = await evRepo.getEventById(pool, tenantId, id);
    if (!existing) {
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    // Wave 1: no scheduling/financial modules — allow delete
    const del = await evRepo.softDeleteEvent(pool, tenantId, id);
    if (!del) {
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    domainBus.emit("event.deleted", {
        event_id: id,
        tenant_id: tenantId,
        name: existing.name,
        client_id: existing.client_id,
        deleted_by: userId,
        deleted_at: del.deleted_at,
    });
    return { ok: true, deleted: del };
}
export async function cloneEvent(tenantId, userId, sourceId, body) {
    const src = await evRepo.getEventById(pool, tenantId, sourceId);
    if (!src) {
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    const opt = body.clone_options ?? {};
    const includeVenue = opt.include_venue !== false;
    const includeTags = opt.include_tags !== false;
    const includeMetadata = opt.include_metadata !== false;
    const dup = await evRepo.findDuplicateEvent(pool, tenantId, src.client_id, body.name, body.start_date, body.end_date);
    if (dup) {
        return {
            ok: false,
            code: "duplicate",
            message: "Duplicate event name for the same client + date range",
            status: 409,
        };
    }
    const id = uuidv7();
    const cloneVenueId = includeVenue ? src.venue_id : null;
    let primaryContactId = null;
    if (src.primary_contact_id) {
        const perr = await validatePrimaryContactForEvent(pool, tenantId, src.primary_contact_id, src.client_id, cloneVenueId);
        if (!perr) {
            primaryContactId = src.primary_contact_id;
        }
    }
    const event = await evRepo.insertEvent(pool, {
        id,
        tenantId,
        name: body.name,
        clientId: src.client_id,
        venueId: cloneVenueId,
        primaryContactId,
        startDate: body.start_date,
        endDate: body.end_date,
        loadIn: src.load_in_date,
        loadOut: src.load_out_date,
        status: "draft",
        phase: "planning",
        description: src.description,
        tags: includeTags ? [...src.tags] : [],
        metadata: includeMetadata ? { ...src.metadata } : {},
        customFields: includeMetadata ? { ...src.custom_fields } : {},
        createdBy: userId,
    });
    emitEntityCustomFieldsUpdated({ tenantId, entityType: "event", entityId: event.id });
    return { ok: true, event, cloned_from: sourceId };
}
export async function transitionPhase(tenantId, userId, id, target, notes) {
    const existing = await evRepo.getEventById(pool, tenantId, id);
    if (!existing) {
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    const from = existing.phase;
    if (!isValidPhaseTransition(from, target)) {
        return {
            ok: false,
            code: "invalid_transition",
            message: "Invalid phase transition",
            status: 400,
        };
    }
    const updated = await evRepo.updateEventPhaseRow(pool, tenantId, id, target);
    if (!updated) {
        return { ok: false, code: "not_found", message: "Event not found", status: 404 };
    }
    const transitioned_at = updated.updated_at;
    domainBus.emit("event.phaseChanged", {
        event_id: id,
        tenant_id: tenantId,
        previous_phase: from,
        new_phase: target,
        notes: notes ?? null,
        changed_by: userId,
        changed_at: transitioned_at,
    });
    return {
        ok: true,
        event: updated,
        previous_phase: from,
        new_phase: target,
        transitioned_at,
    };
}
export async function getEventByIdInternal(eventId, tenantId) {
    return evRepo.getEventById(pool, tenantId, eventId);
}
export async function getEventsByDateRangeInternal(startDate, endDate, tenantId, options) {
    void options?.include_load_dates;
    return evRepo.selectEventsByDateRange(pool, tenantId, startDate, endDate, options?.status, options?.phase);
}
export async function getEventsByClientInternal(clientId, tenantId, options) {
    return evRepo.selectEventsByClient(pool, tenantId, clientId, options?.status, options?.limit);
}
export async function validateEventAccess(eventId, tenantId, _userId, _requiredPermission) {
    const ev = await evRepo.getEventById(pool, tenantId, eventId);
    if (!ev)
        return { allowed: false, reason: "not_found" };
    return { allowed: true };
}
