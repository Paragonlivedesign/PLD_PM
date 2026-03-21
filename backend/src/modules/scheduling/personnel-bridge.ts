/**
 * Personnel ↔ Scheduling boundary (agent-development-strategy).
 *
 * Personnel must not import scheduling services directly; it calls only this module.
 * Implementations read `crew_assignments` (Wave 2). Before that migration existed, these
 * queries returned empty — same contract as a stub, but now live data when present.
 */
import { pool } from "../../db/pool.js";
import {
  countFutureCrewAssignmentsForPersonnel,
  expandCrewAssignmentsToDays,
  expandCrewAssignmentsToDaysByPersonnel,
  listCrewAssignmentsByPersonnelIdsInRange,
} from "./crew-assignments.repository.js";

export type PersonnelAssignmentDay = {
  assignment_id: string;
  event_id: string;
  event_name: string;
  role: string;
  date: string;
};

export async function getAssignmentsForPersonnelDateRange(
  tenantId: string,
  personnelId: string,
  start: string,
  end: string,
): Promise<PersonnelAssignmentDay[]> {
  const rows = await expandCrewAssignmentsToDays(pool, tenantId, personnelId, start, end);
  return rows.map((r) => ({
    assignment_id: r.assignment_id,
    event_id: r.event_id,
    event_name: r.event_name,
    role: r.role,
    date: r.date,
  }));
}

export async function hasFutureCrewAssignmentsForPersonnel(
  tenantId: string,
  personnelId: string,
  fromDate: string,
): Promise<boolean> {
  const n = await countFutureCrewAssignmentsForPersonnel(pool, tenantId, personnelId, fromDate);
  return n > 0;
}

export async function getAssignmentsForPersonnelIdsDateRange(
  tenantId: string,
  personnelIds: string[],
  start: string,
  end: string,
): Promise<Map<string, PersonnelAssignmentDay[]>> {
  const rows = await listCrewAssignmentsByPersonnelIdsInRange(
    pool,
    tenantId,
    personnelIds,
    start,
    end,
  );
  const byPid = expandCrewAssignmentsToDaysByPersonnel(rows, start, end);
  const out = new Map<string, PersonnelAssignmentDay[]>();
  for (const [pid, slices] of byPid) {
    out.set(
      pid,
      slices.map((x) => ({
        assignment_id: x.assignment_id,
        event_id: x.event_id,
        event_name: x.event_name,
        role: x.role,
        date: x.date,
      })),
    );
  }
  return out;
}
