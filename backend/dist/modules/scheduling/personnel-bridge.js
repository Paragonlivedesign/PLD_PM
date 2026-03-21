/**
 * Personnel ↔ Scheduling boundary (agent-development-strategy).
 *
 * Personnel must not import scheduling services directly; it calls only this module.
 * Implementations read `crew_assignments` (Wave 2). Before that migration existed, these
 * queries returned empty — same contract as a stub, but now live data when present.
 */
import { pool } from "../../db/pool.js";
import { countFutureCrewAssignmentsForPersonnel, expandCrewAssignmentsToDays, expandCrewAssignmentsToDaysByPersonnel, listCrewAssignmentsByPersonnelIdsInRange, } from "./crew-assignments.repository.js";
export async function getAssignmentsForPersonnelDateRange(tenantId, personnelId, start, end) {
    const rows = await expandCrewAssignmentsToDays(pool, tenantId, personnelId, start, end);
    return rows.map((r) => ({
        assignment_id: r.assignment_id,
        event_id: r.event_id,
        event_name: r.event_name,
        role: r.role,
        date: r.date,
    }));
}
export async function hasFutureCrewAssignmentsForPersonnel(tenantId, personnelId, fromDate) {
    const n = await countFutureCrewAssignmentsForPersonnel(pool, tenantId, personnelId, fromDate);
    return n > 0;
}
export async function getAssignmentsForPersonnelIdsDateRange(tenantId, personnelIds, start, end) {
    const rows = await listCrewAssignmentsByPersonnelIdsInRange(pool, tenantId, personnelIds, start, end);
    const byPid = expandCrewAssignmentsToDaysByPersonnel(rows, start, end);
    const out = new Map();
    for (const [pid, slices] of byPid) {
        out.set(pid, slices.map((x) => ({
            assignment_id: x.assignment_id,
            event_id: x.event_id,
            event_name: x.event_name,
            role: x.role,
            date: x.date,
        })));
    }
    return out;
}
