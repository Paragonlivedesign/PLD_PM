import { pool } from "../../db/pool.js";
import { getDayRate, getPerDiem } from "../personnel/index.js";
import { listCrewAssignmentsOverlappingRange, mapCrewAssignmentRow, } from "./crew-assignments.repository.js";
import { listTruckAssignmentsOverlappingRange, mapTruckAssignmentRow, } from "./truck-assignments.repository.js";
import { countActiveConflictsForTenant } from "./conflicts.repository.js";
function viewRange(view, anchor) {
    const d = new Date(`${anchor.slice(0, 10)}T12:00:00Z`);
    if (view === "day") {
        const day = anchor.slice(0, 10);
        return { start: day, end: day };
    }
    if (view === "week") {
        const dow = d.getUTCDay();
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const start = new Date(d);
        start.setUTCDate(d.getUTCDate() + mondayOffset);
        const end = new Date(start);
        end.setUTCDate(start.getUTCDate() + 6);
        return {
            start: start.toISOString().slice(0, 10),
            end: end.toISOString().slice(0, 10),
        };
    }
    if (view === "month") {
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const start = new Date(Date.UTC(y, m, 1));
        const end = new Date(Date.UTC(y, m + 1, 0));
        return {
            start: start.toISOString().slice(0, 10),
            end: end.toISOString().slice(0, 10),
        };
    }
    const day = anchor.slice(0, 10);
    return { start: day, end: day };
}
export async function getScheduleViewApi(input) {
    const view = ["day", "week", "month"].includes(input.view) ? input.view : "week";
    const range = viewRange(view, input.date);
    const status = input.status?.length ? input.status : undefined;
    const crewRows = await listCrewAssignmentsOverlappingRange(pool, input.tenantId, range.start, range.end, {
        eventId: input.eventId,
        personnelId: input.personnelId,
        departmentId: input.departmentId,
        status,
    });
    const truckRows = await listTruckAssignmentsOverlappingRange(pool, input.tenantId, range.start, range.end, {
        truckId: input.truckId,
        eventId: input.eventId,
        status,
    });
    const crewBlocks = [];
    for (const r of crewRows) {
        const rates = await Promise.all([
            getDayRate(r.personnel_id, input.tenantId),
            getPerDiem(r.personnel_id, input.tenantId),
        ]);
        const mapped = mapCrewAssignmentRow(r, rates[0].day_rate, rates[1].per_diem);
        crewBlocks.push({
            personnelId: r.personnel_id,
            eventId: r.event_id,
            personnelName: r.personnel_name,
            eventName: r.event_name,
            block: {
                assignment_id: mapped.id,
                assignment_type: "crew",
                event_id: mapped.event_id,
                event_name: mapped.event_name,
                role: mapped.role,
                start_date: mapped.start_date,
                end_date: mapped.end_date,
                status: mapped.status,
                has_conflicts: mapped.has_conflicts,
            },
        });
    }
    const truckBlocks = truckRows.map((r) => {
        const mapped = mapTruckAssignmentRow(r);
        return {
            truckId: r.truck_id,
            eventId: r.event_id,
            truckName: r.truck_name ?? "",
            eventName: r.event_name ?? "",
            block: {
                assignment_id: mapped.id,
                assignment_type: "truck",
                event_id: mapped.event_id,
                event_name: mapped.event_name,
                role: null,
                start_date: mapped.start_date,
                end_date: mapped.end_date,
                status: mapped.status,
                has_conflicts: mapped.has_conflicts,
            },
        };
    });
    const resourceMap = new Map();
    function ensureResource(key, resource_type, resource_id, resource_name) {
        let row = resourceMap.get(key);
        if (!row) {
            row = { resource_type, resource_id, resource_name, assignments: [] };
            resourceMap.set(key, row);
        }
        return row;
    }
    if (input.resourceType === "event") {
        for (const c of crewBlocks) {
            const row = ensureResource(`event:${c.eventId}`, "event", c.eventId, c.eventName);
            row.assignments.push(c.block);
        }
        for (const t of truckBlocks) {
            const row = ensureResource(`event:${t.eventId}`, "event", t.eventId, t.eventName);
            row.assignments.push(t.block);
        }
    }
    else if (input.resourceType === "personnel") {
        for (const c of crewBlocks) {
            const row = ensureResource(`personnel:${c.personnelId}`, "personnel", c.personnelId, c.personnelName);
            row.assignments.push(c.block);
        }
    }
    else {
        for (const t of truckBlocks) {
            const row = ensureResource(`truck:${t.truckId}`, "truck", t.truckId, t.truckName);
            row.assignments.push(t.block);
        }
    }
    const resources = [...resourceMap.values()].sort((a, b) => a.resource_name.localeCompare(b.resource_name));
    const totalAssignments = resources.reduce((s, r) => s + r.assignments.length, 0);
    const conflictCount = await countActiveConflictsForTenant(pool, input.tenantId);
    return {
        data: {
            view,
            range,
            resources,
        },
        meta: {
            total_assignments: totalAssignments,
            conflict_count: conflictCount,
        },
    };
}
