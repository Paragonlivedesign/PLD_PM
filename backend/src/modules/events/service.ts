import { v7 as uuidv7 } from "uuid";
import type { EventPhase, EventResponse, EventStatus } from "@pld/shared";
import { pool } from "../../db/pool.js";
import { domainBus } from "../../domain/bus.js";
import * as clientsRepo from "../clients/repository.js";
import * as evRepo from "./repository.js";
import { isValidPhaseTransition } from "./phase.js";
import type { ListEventsParams } from "./repository.js";
import * as venuesRepo from "../venues/repository.js";
import { validatePrimaryContactForEvent } from "../contacts/event-validation.js";
import { validateCustomFields } from "../custom-fields/service.js";
import { emitEntityCustomFieldsUpdated } from "../../domain/entity-events.js";
import { writeAuditLog } from "../audit/service.js";
import {
  purgeEventRelatedData,
  summarizeEventDeleteBlockers,
  totalBlockers,
} from "./event-delete-support.js";

export function encodeEventCursor(
  ev: EventResponse,
  sortBy: ListEventsParams["sortBy"],
): string {
  let v: string;
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
  return Buffer.from(JSON.stringify({ v, id: ev.id, sb: sortBy }), "utf8").toString(
    "base64url",
  );
}

export function decodeEventCursor(
  raw: string | undefined,
): { v: string; id: string; sortBy: ListEventsParams["sortBy"] } | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      v?: string;
      id?: string;
      sb?: string;
    };
    const sortKeys = ["name", "start_date", "end_date", "created_at", "updated_at"];
    if (
      j.v != null &&
      j.id != null &&
      j.sb != null &&
      sortKeys.includes(j.sb)
    ) {
      return { v: j.v, id: j.id, sortBy: j.sb as ListEventsParams["sortBy"] };
    }
  } catch {
    return null;
  }
  return null;
}

export async function createEvent(
  tenantId: string,
  userId: string,
  body: {
    name: string;
    client_id: string;
    venue_id?: string | null;
    start_date: string;
    end_date: string;
    load_in_date?: string | null;
    load_out_date?: string | null;
    status?: EventStatus;
    phase?: EventPhase;
    description?: string | null;
    tags?: string[];
    metadata?: Record<string, unknown>;
    custom_fields?: Record<string, unknown>;
    primary_contact_id?: string | null;
  },
): Promise<
  | { ok: true; event: EventResponse }
  | { ok: false; code: string; message: string; status: number }
> {
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
    const perr = await validatePrimaryContactForEvent(
      pool,
      tenantId,
      primaryContactId,
      body.client_id,
      body.venue_id ?? null,
    );
    if (perr) {
      return { ok: false, code: "validation", message: perr, status: 400 };
    }
  }
  const dup = await evRepo.findDuplicateEvent(
    pool,
    tenantId,
    body.client_id,
    body.name,
    body.start_date,
    body.end_date,
  );
  if (dup) {
    return {
      ok: false,
      code: "duplicate",
      message: "Duplicate event name for the same client + date range",
      status: 409,
    };
  }
  const id = uuidv7();
  const status: EventStatus = body.status ?? "draft";
  const phase: EventPhase = body.phase ?? "planning";
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

export async function listEventsQuery(
  tenantId: string,
  q: {
    status?: string;
    phase?: string;
    client_id?: string;
    venue_id?: string;
    date_range_start?: string;
    date_range_end?: string;
    search?: string;
    sort_by?: ListEventsParams["sortBy"];
    sort_order?: "asc" | "desc";
    cursor?: string;
    limit?: number;
  },
): Promise<{ rows: EventResponse[]; total: number; nextCursor: string | null }> {
  const sortBy = q.sort_by ?? "start_date";
  const sortOrder = q.sort_order ?? "asc";
  const limit = q.limit ?? 25;
  const dec = decodeEventCursor(q.cursor);
  const cursorVal =
    dec && dec.sortBy === sortBy ? dec.v : null;
  const cursorId = dec && dec.sortBy === sortBy ? dec.id : null;
  const status = q.status
    ? q.status.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const phase = q.phase
    ? q.phase.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const p: ListEventsParams = {
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
  const nextCursor =
    hasMore && last ? encodeEventCursor(last, sortBy) : null;
  return { rows: page, total, nextCursor };
}

export async function getEvent(
  tenantId: string,
  id: string,
): Promise<EventResponse | null> {
  return evRepo.getEventById(pool, tenantId, id);
}

export async function updateEvent(
  tenantId: string,
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<
  | { ok: true; event: EventResponse }
  | { ok: false; code: string; message: string; status: number; field?: string }
> {
  const existing = await evRepo.getEventById(pool, tenantId, id);
  if (!existing) {
    return { ok: false, code: "not_found", message: "Event not found", status: 404 };
  }
  if (body.client_id) {
    const cl = await clientsRepo.getClientById(pool, tenantId, body.client_id as string);
    if (!cl) {
      return { ok: false, code: "not_found", message: "client not found", status: 400 };
    }
  }
  if (body.venue_id !== undefined && body.venue_id !== null) {
    const vn = await venuesRepo.getVenueById(pool, tenantId, body.venue_id as string);
    if (!vn) {
      return { ok: false, code: "not_found", message: "venue not found", status: 400 };
    }
  }
  const nextClientId =
    typeof body.client_id === "string" ? body.client_id : existing.client_id;
  const nextVenueId =
    body.venue_id !== undefined ? (body.venue_id as string | null) : existing.venue_id;
  const effectivePrimaryContactId =
    body.primary_contact_id !== undefined
      ? (body.primary_contact_id as string | null)
      : existing.primary_contact_id;
  if (effectivePrimaryContactId) {
    const perr = await validatePrimaryContactForEvent(
      pool,
      tenantId,
      effectivePrimaryContactId,
      nextClientId,
      nextVenueId,
    );
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
  const expected = body.updated_at as string | undefined;
  const patch = { ...body } as Record<string, unknown>;
  delete patch.updated_at;
  if (patch.custom_fields !== undefined) {
    const merged = {
      ...existing.custom_fields,
      ...(patch.custom_fields as Record<string, unknown>),
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
  const start =
    (patch.start_date as string) ?? existing.start_date;
  const end = (patch.end_date as string) ?? existing.end_date;
  if (patch.name || patch.start_date || patch.end_date) {
    const dup = await evRepo.findDuplicateEvent(
      pool,
      tenantId,
      (patch.client_id as string) ?? existing.client_id,
      (patch.name as string) ?? existing.name,
      start,
      end,
      id,
    );
    if (dup) {
      return {
        ok: false,
        code: "duplicate",
        message: "Duplicate event name for the same client + date range",
        status: 409,
      };
    }
  }
  const prev: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) {
    if (k in existing) {
      prev[k] = (existing as unknown as Record<string, unknown>)[k];
    }
  }
  const updated = await evRepo.updateEventRow(
    pool,
    tenantId,
    id,
    patch,
    expected,
  );
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
  void writeAuditLog(pool, {
    tenantId,
    userId,
    entityType: "event",
    entityId: id,
    action: "update",
    changes: { fields: Object.keys(patch), before: prev, after: patch },
  }).catch(() => undefined);
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

export async function deleteEvent(
  tenantId: string,
  userId: string,
  id: string,
  options?: { force?: boolean },
): Promise<
  | { ok: true; deleted: { id: string; deleted_at: string } }
  | { ok: false; code: string; message: string; status: number; details?: unknown }
> {
  const existing = await evRepo.getEventById(pool, tenantId, id);
  if (!existing) {
    return { ok: false, code: "not_found", message: "Event not found", status: 404 };
  }
  const force = options?.force === true;
  const blockers = await summarizeEventDeleteBlockers(pool, tenantId, id);
  if (totalBlockers(blockers) > 0 && !force) {
    return {
      ok: false,
      code: "conflict",
      message:
        "Event has related scheduling, financial, or document data. Open the event tabs to review, cancel the event instead, or delete with force to remove related rows first.",
      status: 409,
      details: { blockers },
    };
  }
  if (totalBlockers(blockers) > 0 && force) {
    await purgeEventRelatedData(pool, tenantId, id);
  }
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
  void writeAuditLog(pool, {
    tenantId,
    userId,
    entityType: "event",
    entityId: id,
    action: "delete",
    changes: { before: { name: existing.name } },
  }).catch(() => undefined);
  return { ok: true, deleted: del };
}

export async function restoreSoftDeletedEvent(
  tenantId: string,
  userId: string,
  id: string,
): Promise<
  | { ok: true; event: EventResponse }
  | { ok: false; code: string; message: string; status: number }
> {
  const row = await evRepo.getEventRowByIdAnyDeletedState(pool, tenantId, id);
  if (!row) {
    return { ok: false, code: "not_found", message: "Event not found", status: 404 };
  }
  if (row.deleted_at === null) {
    return { ok: false, code: "not_deleted", message: "Event is not deleted", status: 409 };
  }
  const restored = await evRepo.restoreSoftDeletedEventRow(pool, tenantId, id);
  if (!restored) {
    return { ok: false, code: "not_found", message: "Could not restore event", status: 404 };
  }
  domainBus.emit("event.restored", {
    event_id: id,
    tenant_id: tenantId,
    restored_by: userId,
    name: restored.name,
  });
  void writeAuditLog(pool, {
    tenantId,
    userId,
    entityType: "event",
    entityId: id,
    action: "restore",
    changes: { after: { name: restored.name } },
  }).catch(() => undefined);
  return { ok: true, event: restored };
}

export async function cloneEvent(
  tenantId: string,
  userId: string,
  sourceId: string,
  body: {
    name: string;
    start_date: string;
    end_date: string;
    clone_options?: {
      include_venue?: boolean;
      include_tags?: boolean;
      include_metadata?: boolean;
    };
  },
): Promise<
  | { ok: true; event: EventResponse; cloned_from: string }
  | { ok: false; code: string; message: string; status: number }
> {
  const src = await evRepo.getEventById(pool, tenantId, sourceId);
  if (!src) {
    return { ok: false, code: "not_found", message: "Event not found", status: 404 };
  }
  const opt = body.clone_options ?? {};
  const includeVenue = opt.include_venue !== false;
  const includeTags = opt.include_tags !== false;
  const includeMetadata = opt.include_metadata !== false;
  const dup = await evRepo.findDuplicateEvent(
    pool,
    tenantId,
    src.client_id,
    body.name,
    body.start_date,
    body.end_date,
  );
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
  let primaryContactId: string | null = null;
  if (src.primary_contact_id) {
    const perr = await validatePrimaryContactForEvent(
      pool,
      tenantId,
      src.primary_contact_id,
      src.client_id,
      cloneVenueId,
    );
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
  void writeAuditLog(pool, {
    tenantId,
    userId,
    entityType: "event",
    entityId: event.id,
    action: "clone",
    changes: { cloned_from: sourceId, name: event.name },
  }).catch(() => undefined);
  return { ok: true, event, cloned_from: sourceId };
}

export async function transitionPhase(
  tenantId: string,
  userId: string,
  id: string,
  target: EventPhase,
  notes?: string | null,
): Promise<
  | {
      ok: true;
      event: EventResponse;
      previous_phase: string;
      new_phase: string;
      transitioned_at: string;
    }
  | { ok: false; code: string; message: string; status: number }
> {
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
  void writeAuditLog(pool, {
    tenantId,
    userId,
    entityType: "event",
    entityId: id,
    action: "phase_transition",
    changes: { from, to: target },
  }).catch(() => undefined);
  return {
    ok: true,
    event: updated,
    previous_phase: from,
    new_phase: target,
    transitioned_at,
  };
}

export async function getEventByIdInternal(
  eventId: string,
  tenantId: string,
): Promise<EventResponse | null> {
  return evRepo.getEventById(pool, tenantId, eventId);
}

export async function getEventsByDateRangeInternal(
  startDate: string,
  endDate: string,
  tenantId: string,
  options?: {
    status?: EventStatus[];
    phase?: EventPhase[];
    include_load_dates?: boolean;
  },
): Promise<EventResponse[]> {
  void options?.include_load_dates;
  return evRepo.selectEventsByDateRange(
    pool,
    tenantId,
    startDate,
    endDate,
    options?.status as string[] | undefined,
    options?.phase as string[] | undefined,
  );
}

export async function getEventsByClientInternal(
  clientId: string,
  tenantId: string,
  options?: { status?: EventStatus[]; limit?: number },
): Promise<EventResponse[]> {
  return evRepo.selectEventsByClient(
    pool,
    tenantId,
    clientId,
    options?.status as string[] | undefined,
    options?.limit,
  );
}

export async function validateEventAccess(
  eventId: string,
  tenantId: string,
  _userId: string,
  _requiredPermission?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const ev = await evRepo.getEventById(pool, tenantId, eventId);
  if (!ev) return { allowed: false, reason: "not_found" };
  return { allowed: true };
}
