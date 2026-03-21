import { pool } from "../../db/pool.js";
import { domainBus } from "../../domain/bus.js";
import { newId } from "../../utils/ids.js";
import { overlapDatesLabel, overlapRange } from "../../utils/dates.js";
import { calendarHoursBetweenIsoDates, driveHoursForDistanceKm, haversineKm, } from "../../utils/geo.js";
import { getEventByIdInternal } from "../events/index.js";
import { getVenueById } from "../venues/repository.js";
import { findDepartmentById } from "../tenancy/department.repository.js";
import { getTenantConfig } from "../tenancy/tenancy.service.js";
import { tenantBufferWindowsEnabledResolved, tenantConflictDetectionEnabledResolved, tenantDriveTimeBufferHoursResolved, } from "../tenancy/tenant-settings.js";
import { getDayRate, getPerDiem, getPersonnelById } from "../personnel/index.js";
import { getConflictById, insertSchedulingConflict, mapConflictRow, refreshHasConflictsForParticipants, resolveActiveDriveConflictsForPersonnel, resolveConflictsTouchingAssignment, } from "./conflicts.repository.js";
import { findOverlappingCrewAssignments, getCrewAssignmentById, insertCrewAssignment, listAllActiveCrewAssignmentsForPersonnel, listCrewAssignments, listCrewAssignmentsByEventId, countCrewAssignments, mapCrewAssignmentRow, softDeleteCrewAssignment, updateCrewAssignment, } from "./crew-assignments.repository.js";
function dbx(client) {
    return client ?? pool;
}
function isoDate(d) {
    if (typeof d === "string")
        return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
}
function personnelFullName(p) {
    return `${p.first_name} ${p.last_name}`.trim();
}
function crewRef(row) {
    return {
        assignment_id: row.id,
        assignment_type: "crew",
        event_id: row.event_id,
        event_name: row.event_name,
        start_date: isoDate(row.start_date),
        end_date: isoDate(row.end_date),
    };
}
function encodeCrewCursor(offset) {
    return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}
export function decodeCrewCursor(cursor) {
    if (!cursor)
        return 0;
    try {
        const o = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        return typeof o.o === "number" && o.o >= 0 ? o.o : 0;
    }
    catch {
        return 0;
    }
}
async function ratesForPersonnel(tenantId, personnelId) {
    const [dr, pd] = await Promise.all([
        getDayRate(personnelId, tenantId),
        getPerDiem(personnelId, tenantId),
    ]);
    return { dayRate: dr.day_rate, perDiem: pd.per_diem };
}
function summaryFromConflictRow(row, overlapDates) {
    return {
        conflict_id: row.id,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        resource_name: row.resource_name,
        severity: row.severity,
        overlap_dates: overlapDates,
        conflict_kind: row.conflict_kind,
    };
}
async function createSoftConflictsForCrewPairwise(client, tenantId, personnelId, personnelName, newRow, overlapping) {
    const cfg = await getTenantConfig(tenantId);
    if (!tenantConflictDetectionEnabledResolved(cfg))
        return [];
    if (!tenantBufferWindowsEnabledResolved(cfg))
        return [];
    const summaries = [];
    for (const ex of overlapping) {
        const { start, end } = overlapRange(isoDate(newRow.start_date), isoDate(newRow.end_date), isoDate(ex.start_date), isoDate(ex.end_date));
        const assignments = [crewRef(newRow), crewRef(ex)];
        const e1 = newRow.event_id < ex.event_id ? newRow.event_id : ex.event_id;
        const e2 = newRow.event_id < ex.event_id ? ex.event_id : newRow.event_id;
        const cid = newId();
        await insertSchedulingConflict(client, {
            id: cid,
            tenantId,
            resourceType: "personnel",
            resourceId: personnelId,
            resourceName: personnelName,
            severity: "soft",
            overlapStart: start,
            overlapEnd: end,
            assignments,
            eventId1: e1,
            eventId2: e2,
            conflictKind: "double_booking",
        });
        const full = await getConflictById(client, tenantId, cid);
        if (full) {
            const mapped = mapConflictRow(full);
            summaries.push(summaryFromConflictRow(mapped, overlapDatesLabel(start, end)));
            domainBus.emit("conflict.detected", {
                conflict_id: cid,
                tenant_id: tenantId,
                resource_type: "personnel",
                resource_id: personnelId,
                resource_name: personnelName,
                severity: "soft",
                assignment_ids: [newRow.id, ex.id],
                overlap_start: start,
                overlap_end: end,
                detected_at: mapped.detected_at,
            });
        }
    }
    await refreshHasConflictsForParticipants(client, tenantId, [
        { type: "crew", id: newRow.id },
        ...overlapping.map((o) => ({ type: "crew", id: o.id })),
    ]);
    return summaries;
}
/**
 * CP2 2.E.3 — consecutive non-overlapping gigs: if calendar gap (hours) < drive time between venues, soft conflict.
 */
async function refreshDriveTimeConflictsForPersonnel(client, tenantId, personnelId, personnelName) {
    const cfg = await getTenantConfig(tenantId);
    if (!tenantConflictDetectionEnabledResolved(cfg))
        return [];
    const bufferExtra = tenantDriveTimeBufferHoursResolved(cfg);
    await resolveActiveDriveConflictsForPersonnel(client, tenantId, personnelId);
    const rows = await listAllActiveCrewAssignmentsForPersonnel(client, tenantId, personnelId);
    rows.sort((a, b) => {
        const c = isoDate(a.start_date).localeCompare(isoDate(b.start_date));
        return c !== 0 ? c : isoDate(a.end_date).localeCompare(isoDate(b.end_date));
    });
    const summaries = [];
    for (let i = 0; i < rows.length - 1; i++) {
        const first = rows[i];
        const second = rows[i + 1];
        if (isoDate(first.end_date) >= isoDate(second.start_date))
            continue;
        const gapH = calendarHoursBetweenIsoDates(isoDate(first.end_date), isoDate(second.start_date));
        const ev1 = await getEventByIdInternal(first.event_id, tenantId);
        const ev2 = await getEventByIdInternal(second.event_id, tenantId);
        if (!ev1?.venue_id || !ev2?.venue_id)
            continue;
        const [v1, v2] = await Promise.all([
            getVenueById(client, tenantId, ev1.venue_id),
            getVenueById(client, tenantId, ev2.venue_id),
        ]);
        if (v1?.latitude == null ||
            v1.longitude == null ||
            v2?.latitude == null ||
            v2.longitude == null) {
            continue;
        }
        const km = haversineKm(v1.latitude, v1.longitude, v2.latitude, v2.longitude);
        const needH = driveHoursForDistanceKm(km) + bufferExtra;
        if (gapH >= needH)
            continue;
        const assignments = [crewRef(first), crewRef(second)];
        const e1 = first.event_id < second.event_id ? first.event_id : second.event_id;
        const e2 = first.event_id < second.event_id ? second.event_id : first.event_id;
        const cid = newId();
        await insertSchedulingConflict(client, {
            id: cid,
            tenantId,
            resourceType: "personnel",
            resourceId: personnelId,
            resourceName: personnelName,
            severity: "soft",
            overlapStart: isoDate(first.end_date),
            overlapEnd: isoDate(second.start_date),
            assignments,
            eventId1: e1,
            eventId2: e2,
            conflictKind: "drive_time_infeasible",
        });
        const full = await getConflictById(client, tenantId, cid);
        if (full) {
            const mapped = mapConflictRow(full);
            summaries.push(summaryFromConflictRow(mapped, overlapDatesLabel(isoDate(first.end_date), isoDate(second.start_date))));
            domainBus.emit("conflict.detected", {
                conflict_id: cid,
                tenant_id: tenantId,
                resource_type: "personnel",
                resource_id: personnelId,
                resource_name: personnelName,
                severity: "soft",
                conflict_kind: "drive_time_infeasible",
                assignment_ids: [first.id, second.id],
                overlap_start: isoDate(first.end_date),
                overlap_end: isoDate(second.start_date),
                detected_at: mapped.detected_at,
            });
        }
    }
    if (summaries.length > 0) {
        await refreshHasConflictsForParticipants(client, tenantId, rows.map((r) => ({ type: "crew", id: r.id })));
    }
    return summaries;
}
function validateCrewStatus(s) {
    return s === "tentative" || s === "confirmed" || s === "cancelled";
}
export async function createCrewAssignmentApi(input) {
    const db = dbx(input.client);
    const statusNorm = input.status || "tentative";
    if (!validateCrewStatus(statusNorm)) {
        return { ok: false, status: 400, code: "VALIDATION", message: "Invalid status", field: "status" };
    }
    if (!input.role?.trim()) {
        return { ok: false, status: 400, code: "VALIDATION", message: "role is required", field: "role" };
    }
    const event = await getEventByIdInternal(input.eventId, input.tenantId);
    if (!event) {
        return { ok: false, status: 404, code: "NOT_FOUND", message: "Event not found" };
    }
    const personnel = await getPersonnelById(input.personnelId, input.tenantId, {
        include_deactivated: true,
    });
    if (!personnel) {
        return { ok: false, status: 404, code: "NOT_FOUND", message: "Personnel not found" };
    }
    if (personnel.status !== "active") {
        return {
            ok: false,
            status: 400,
            code: "VALIDATION",
            message: "Personnel is not active",
            field: "personnel_id",
        };
    }
    let departmentName = null;
    if (input.departmentId) {
        const dept = await findDepartmentById(db, input.tenantId, input.departmentId, false);
        if (!dept) {
            return {
                ok: false,
                status: 400,
                code: "VALIDATION",
                message: "Department not found",
                field: "department_id",
            };
        }
        departmentName = dept.name;
    }
    const overlaps = await findOverlappingCrewAssignments(db, input.tenantId, input.personnelId, input.startDate, input.endDate);
    if (statusNorm === "confirmed" && overlaps.length > 0) {
        return {
            ok: false,
            status: 409,
            code: "crew_overlap_confirm",
            message: "Cannot confirm assignment with overlapping dates",
        };
    }
    if (overlaps.some((o) => o.status === "confirmed")) {
        return {
            ok: false,
            status: 409,
            code: "personnel_has_confirmed_overlap",
            message: "Personnel already has a confirmed assignment for overlapping dates",
        };
    }
    const hasSoftOverlap = overlaps.length > 0;
    const id = newId();
    const rates = await ratesForPersonnel(input.tenantId, input.personnelId);
    const row = await insertCrewAssignment(db, {
        id,
        tenantId: input.tenantId,
        eventId: input.eventId,
        eventName: event.name,
        personnelId: input.personnelId,
        personnelName: personnelFullName(personnel),
        role: input.role.trim(),
        departmentId: input.departmentId,
        departmentName,
        startDate: input.startDate,
        endDate: input.endDate,
        startTime: input.startTime,
        endTime: input.endTime,
        dayRateOverride: input.dayRateOverride,
        perDiemOverride: input.perDiemOverride,
        notes: input.notes,
        status: statusNorm,
        hasConflicts: hasSoftOverlap,
    });
    let conflicts = [];
    if (hasSoftOverlap) {
        conflicts = await createSoftConflictsForCrewPairwise(db, input.tenantId, input.personnelId, personnelFullName(personnel), row, overlaps);
    }
    const driveCx = await refreshDriveTimeConflictsForPersonnel(db, input.tenantId, input.personnelId, personnelFullName(personnel));
    conflicts = [...conflicts, ...driveCx];
    const data = mapCrewAssignmentRow(row, rates.dayRate, rates.perDiem);
    const totalDays = data.total_days;
    domainBus.emit("assignment.created", {
        assignment_id: data.id,
        assignment_type: "crew",
        tenant_id: input.tenantId,
        event_id: data.event_id,
        resource_id: input.personnelId,
        resource_type: "personnel",
        role: data.role,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        day_rate: Number(data.day_rate),
        total_days: totalDays,
        created_by: input.userId,
        created_at: data.created_at,
    });
    return { ok: true, data, conflicts };
}
export async function getCrewAssignment(tenantId, id, client) {
    const row = await getCrewAssignmentById(dbx(client), tenantId, id);
    if (!row)
        return null;
    const rates = await ratesForPersonnel(tenantId, row.personnel_id);
    return mapCrewAssignmentRow(row, rates.dayRate, rates.perDiem);
}
export async function listCrewAssignmentsApi(p) {
    const offset = decodeCrewCursor(p.cursor);
    const total = await countCrewAssignments(pool, {
        tenantId: p.tenantId,
        eventId: p.eventId,
        personnelId: p.personnelId,
        departmentId: p.departmentId,
        status: p.status,
        dateRangeStart: p.dateRangeStart,
        dateRangeEnd: p.dateRangeEnd,
    });
    const raw = await listCrewAssignments(pool, {
        tenantId: p.tenantId,
        eventId: p.eventId,
        personnelId: p.personnelId,
        departmentId: p.departmentId,
        status: p.status,
        dateRangeStart: p.dateRangeStart,
        dateRangeEnd: p.dateRangeEnd,
        sortBy: p.sortBy,
        sortOrder: p.sortOrder,
        limit: p.limit,
        offset,
    });
    const hasMore = raw.length > p.limit;
    const slice = hasMore ? raw.slice(0, p.limit) : raw;
    const nextCursor = hasMore && slice.length > 0 ? encodeCrewCursor(offset + p.limit) : null;
    const rows = [];
    for (const r of slice) {
        const rates = await ratesForPersonnel(p.tenantId, r.personnel_id);
        rows.push(mapCrewAssignmentRow(r, rates.dayRate, rates.perDiem));
    }
    return { rows, total, nextCursor, hasMore };
}
export async function updateCrewAssignmentApi(tenantId, userId, id, patch, client) {
    const db = dbx(client);
    const cur = await getCrewAssignmentById(db, tenantId, id);
    if (!cur)
        return { ok: false, status: 404, code: "NOT_FOUND", message: "Not found" };
    await resolveConflictsTouchingAssignment(db, tenantId, "crew", id);
    const start = patch.startDate ?? isoDate(cur.start_date);
    const end = patch.endDate ?? isoDate(cur.end_date);
    const nextStatus = patch.status ?? cur.status;
    if (patch.status !== undefined && !validateCrewStatus(patch.status)) {
        return { ok: false, status: 400, code: "VALIDATION", message: "Invalid status", field: "status" };
    }
    let departmentId = patch.departmentId !== undefined ? patch.departmentId : cur.department_id;
    let departmentName = patch.departmentName !== undefined ? patch.departmentName : cur.department_name;
    if (patch.departmentId !== undefined) {
        if (patch.departmentId === null) {
            departmentName = null;
        }
        else {
            const dept = await findDepartmentById(db, tenantId, patch.departmentId, false);
            if (!dept) {
                return {
                    ok: false,
                    status: 400,
                    code: "VALIDATION",
                    message: "Department not found",
                    field: "department_id",
                };
            }
            departmentName = dept.name;
        }
    }
    const overlaps = await findOverlappingCrewAssignments(db, tenantId, cur.personnel_id, start, end, id);
    if (nextStatus === "confirmed" && overlaps.length > 0) {
        return {
            ok: false,
            status: 409,
            code: "crew_overlap_confirm",
            message: "Cannot confirm assignment with overlapping dates",
        };
    }
    if (overlaps.some((o) => o.status === "confirmed")) {
        return {
            ok: false,
            status: 409,
            code: "personnel_has_confirmed_overlap",
            message: "Personnel already has a confirmed assignment for overlapping dates",
        };
    }
    const event = await getEventByIdInternal(cur.event_id, tenantId);
    const personnel = await getPersonnelById(cur.personnel_id, tenantId, { include_deactivated: true });
    const row = await updateCrewAssignment(db, tenantId, id, {
        role: patch.role,
        departmentId,
        departmentName,
        startDate: patch.startDate,
        endDate: patch.endDate,
        startTime: patch.startTime,
        endTime: patch.endTime,
        dayRateOverride: patch.dayRateOverride,
        perDiemOverride: patch.perDiemOverride,
        notes: patch.notes,
        status: patch.status,
        eventName: event?.name ?? cur.event_name,
        personnelName: personnel ? personnelFullName(personnel) : cur.personnel_name,
        hasConflicts: overlaps.length > 0,
    });
    if (!row)
        return { ok: false, status: 404, code: "NOT_FOUND", message: "Not found" };
    let conflicts = [];
    if (overlaps.length > 0) {
        conflicts = await createSoftConflictsForCrewPairwise(db, tenantId, cur.personnel_id, personnel ? personnelFullName(personnel) : cur.personnel_name, row, overlaps);
    }
    const driveCx = await refreshDriveTimeConflictsForPersonnel(db, tenantId, cur.personnel_id, personnel ? personnelFullName(personnel) : cur.personnel_name);
    conflicts = [...conflicts, ...driveCx];
    const rates = await ratesForPersonnel(tenantId, row.personnel_id);
    const data = mapCrewAssignmentRow(row, rates.dayRate, rates.perDiem);
    domainBus.emit("assignment.updated", {
        assignment_id: data.id,
        assignment_type: "crew",
        tenant_id: tenantId,
        event_id: data.event_id,
        resource_id: data.personnel_id,
        changed_fields: Object.keys(patch).filter((k) => patch[k] !== undefined),
        previous_values: {},
        new_values: patch,
        updated_by: userId,
        updated_at: data.updated_at,
    });
    return { ok: true, data, conflicts };
}
export async function deleteCrewAssignmentApi(tenantId, userId, id, client) {
    const db = dbx(client);
    const cur = await getCrewAssignmentById(db, tenantId, id);
    if (!cur)
        return { ok: false, status: 404 };
    const resolvedConflictIds = await resolveConflictsTouchingAssignment(db, tenantId, "crew", id);
    const r = await softDeleteCrewAssignment(db, tenantId, id);
    if (!r)
        return { ok: false, status: 404 };
    domainBus.emit("assignment.deleted", {
        assignment_id: id,
        assignment_type: "crew",
        tenant_id: tenantId,
        event_id: cur.event_id,
        resource_id: cur.personnel_id,
        start_date: isoDate(cur.start_date),
        end_date: isoDate(cur.end_date),
        deleted_by: userId,
        deleted_at: r.deleted_at,
    });
    for (const conflictId of resolvedConflictIds) {
        domainBus.emit("conflict.resolved", {
            conflict_id: conflictId,
            tenant_id: tenantId,
            resource_type: "personnel",
            resource_id: cur.personnel_id,
            resolution: "assignment_deleted",
            resolved_by: userId,
            resolved_at: r.deleted_at,
        });
    }
    return { ok: true, data: r };
}
/**
 * After event start/end dates change: resolve crew conflicts touching assignments on this event,
 * then re-run overlap detection so CP2 **2.E.6**-style scenarios pick up new overlaps.
 */
export async function resyncCrewConflictsForEventAfterDateChange(tenantId, eventId, client) {
    const db = dbx(client);
    const rows = await listCrewAssignmentsByEventId(db, tenantId, eventId);
    for (const r of rows) {
        await resolveConflictsTouchingAssignment(db, tenantId, "crew", r.id);
    }
    for (const row of rows) {
        const overlaps = await findOverlappingCrewAssignments(db, tenantId, row.personnel_id, isoDate(row.start_date), isoDate(row.end_date), row.id);
        if (overlaps.length === 0)
            continue;
        await createSoftConflictsForCrewPairwise(db, tenantId, row.personnel_id, row.personnel_name, row, overlaps);
    }
}
