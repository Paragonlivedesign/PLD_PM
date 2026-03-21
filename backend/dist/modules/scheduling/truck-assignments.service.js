import { pool } from "../../db/pool.js";
import { domainBus } from "../../domain/bus.js";
import { newId } from "../../utils/ids.js";
import { resolveConflictsTouchingAssignment } from "./conflicts.repository.js";
import { findOverlappingDriverAssignments, findOverlappingTruckAssignments, getTruckAssignmentById, insertTruckAssignment, listTruckAssignments, countTruckAssignments, mapTruckAssignmentRow, softDeleteTruckAssignment, updateTruckAssignment, } from "./truck-assignments.repository.js";
import { getTruckRowById } from "../trucks/trucks.repository.js";
function dbx(client) {
    return client ?? pool;
}
export async function createTruckAssignmentApi(input) {
    const db = dbx(input.client);
    const truck = await getTruckRowById(db, input.tenantId, input.truckId);
    if (!truck || truck.deleted_at) {
        return {
            ok: false,
            status: 404,
            code: "truck_not_found",
            message: "Truck not found",
        };
    }
    if (truck.status === "retired" || truck.status === "maintenance") {
        return {
            ok: false,
            status: 409,
            code: "truck_unavailable",
            message: "Truck is not available for assignment",
        };
    }
    const overlaps = await findOverlappingTruckAssignments(db, input.tenantId, input.truckId, input.startDate, input.endDate);
    if (overlaps.length > 0) {
        return {
            ok: false,
            status: 409,
            code: "truck_overlap",
            message: "Truck already assigned for overlapping dates",
        };
    }
    if (input.driverId) {
        const dOv = await findOverlappingDriverAssignments(db, input.tenantId, input.driverId, input.startDate, input.endDate);
        if (dOv.length > 0) {
            return {
                ok: false,
                status: 409,
                code: "driver_overlap",
                message: "Driver already assigned for overlapping dates",
            };
        }
    }
    const id = newId();
    const row = await insertTruckAssignment(db, {
        id,
        tenantId: input.tenantId,
        eventId: input.eventId,
        truckId: input.truckId,
        purpose: input.purpose,
        startDate: input.startDate,
        endDate: input.endDate,
        driverId: input.driverId,
        notes: input.notes,
        status: input.status,
        hasConflicts: false,
    });
    const data = mapTruckAssignmentRow(row);
    domainBus.emit("assignment.created", {
        assignment_id: data.id,
        assignment_type: "truck",
        tenant_id: input.tenantId,
        event_id: data.event_id,
        resource_id: data.truck_id,
        resource_type: "truck",
        role: null,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        day_rate: null,
        total_days: data.total_days,
        created_by: input.userId,
        created_at: data.created_at,
    });
    return { ok: true, data, conflicts: [] };
}
export async function getTruckAssignment(tenantId, id, client) {
    const row = await getTruckAssignmentById(dbx(client), tenantId, id);
    return row ? mapTruckAssignmentRow(row) : null;
}
export async function listTruckAssignmentsApi(p) {
    const { limit: _lim, cursorId: _cur, ...countParams } = p;
    const total = await countTruckAssignments(dbx(), countParams);
    const raw = await listTruckAssignments(dbx(), p);
    const hasMore = raw.length > p.limit;
    const slice = hasMore ? raw.slice(0, p.limit) : raw;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;
    return {
        rows: slice.map(mapTruckAssignmentRow),
        total,
        nextCursor,
        hasMore,
    };
}
export async function updateTruckAssignmentApi(tenantId, userId, id, patch, client) {
    const db = dbx(client);
    const cur = await getTruckAssignmentById(db, tenantId, id);
    if (!cur)
        return { ok: false, status: 404, code: "not_found", message: "Not found" };
    const start = patch.startDate ?? cur.start_date.toString().slice(0, 10);
    const end = patch.endDate ?? cur.end_date.toString().slice(0, 10);
    const truckId = cur.truck_id;
    const driverId = patch.driverId !== undefined ? patch.driverId : cur.driver_id;
    const overlaps = await findOverlappingTruckAssignments(db, tenantId, truckId, start, end, id);
    if (overlaps.length > 0) {
        return {
            ok: false,
            status: 409,
            code: "truck_overlap",
            message: "Truck already assigned for overlapping dates",
        };
    }
    if (driverId) {
        const dOv = await findOverlappingDriverAssignments(db, tenantId, driverId, start, end, id);
        if (dOv.length > 0) {
            return {
                ok: false,
                status: 409,
                code: "driver_overlap",
                message: "Driver already assigned for overlapping dates",
            };
        }
    }
    const row = await updateTruckAssignment(db, tenantId, id, {
        purpose: patch.purpose,
        startDate: patch.startDate,
        endDate: patch.endDate,
        driverId: patch.driverId,
        notes: patch.notes,
        status: patch.status,
    });
    if (!row)
        return { ok: false, status: 404, code: "not_found", message: "Not found" };
    const data = mapTruckAssignmentRow(row);
    domainBus.emit("assignment.updated", {
        assignment_id: data.id,
        assignment_type: "truck",
        tenant_id: tenantId,
        event_id: data.event_id,
        resource_id: data.truck_id,
        changed_fields: Object.keys(patch).filter((k) => patch[k] !== undefined),
        previous_values: {},
        new_values: patch,
        updated_by: userId,
        updated_at: data.updated_at,
    });
    return { ok: true, data, conflicts: [] };
}
export async function deleteTruckAssignmentApi(tenantId, userId, id, client) {
    const db = dbx(client);
    const cur = await getTruckAssignmentById(db, tenantId, id);
    if (!cur)
        return { ok: false, status: 404 };
    const resolvedConflictIds = await resolveConflictsTouchingAssignment(db, tenantId, "truck", id);
    const r = await softDeleteTruckAssignment(db, tenantId, id);
    if (!r)
        return { ok: false, status: 404 };
    domainBus.emit("assignment.deleted", {
        assignment_id: id,
        assignment_type: "truck",
        tenant_id: tenantId,
        event_id: cur.event_id,
        resource_id: cur.truck_id,
        start_date: cur.start_date.toString().slice(0, 10),
        end_date: cur.end_date.toString().slice(0, 10),
        deleted_by: userId,
        deleted_at: r.deleted_at,
    });
    for (const conflictId of resolvedConflictIds) {
        domainBus.emit("conflict.resolved", {
            conflict_id: conflictId,
            tenant_id: tenantId,
            resource_type: "truck",
            resource_id: cur.truck_id,
            resolution: "assignment_deleted",
            resolved_by: userId,
            resolved_at: r.deleted_at,
        });
    }
    return { ok: true, data: r };
}
