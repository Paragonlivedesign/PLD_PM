import type {
  ScheduleAssignmentBlock,
  ScheduleResourceRow,
  ScheduleTruckRouteBlock,
  ScheduleViewMeta,
  ScheduleViewResponse,
} from "@pld/shared";
import { pool } from "../../db/pool.js";
import { listTruckRoutesOverlappingDateRange } from "../trucks/truck-routes.repository.js";
import { getDayRate, getPerDiem } from "../personnel/index.js";
import {
  listCrewAssignmentsOverlappingRange,
  mapCrewAssignmentRow,
} from "./crew-assignments.repository.js";
import {
  listTruckAssignmentsOverlappingRange,
  mapTruckAssignmentRow,
} from "./truck-assignments.repository.js";
import { countActiveConflictsForTenant } from "./conflicts.repository.js";

function viewRange(
  view: string,
  anchor: string,
): { start: string; end: string } {
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

export async function getScheduleViewApi(input: {
  tenantId: string;
  view: string;
  date: string;
  resourceType: "personnel" | "truck" | "event";
  eventId?: string;
  departmentId?: string;
  personnelId?: string;
  truckId?: string;
  status?: string[];
}): Promise<{ data: ScheduleViewResponse; meta: ScheduleViewMeta }> {
  const view = ["day", "week", "month"].includes(input.view) ? input.view : "week";
  const range = viewRange(view, input.date);
  const status = input.status?.length ? input.status : undefined;

  const crewRows = await listCrewAssignmentsOverlappingRange(
    pool,
    input.tenantId,
    range.start,
    range.end,
    {
      eventId: input.eventId,
      personnelId: input.personnelId,
      departmentId: input.departmentId,
      status,
    },
  );
  const truckRows = await listTruckAssignmentsOverlappingRange(
    pool,
    input.tenantId,
    range.start,
    range.end,
    {
      truckId: input.truckId,
      eventId: input.eventId,
      status,
    },
  );

  const crewBlocks: {
    block: ScheduleAssignmentBlock;
    personnelId: string;
    eventId: string;
    personnelName: string;
    eventName: string;
  }[] = [];
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
        assignment_type: "crew" as const,
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
        assignment_type: "truck" as const,
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

  const resourceMap = new Map<string, ScheduleResourceRow>();

  function ensureResource(
    key: string,
    resource_type: ScheduleResourceRow["resource_type"],
    resource_id: string,
    resource_name: string,
  ): ScheduleResourceRow {
    let row = resourceMap.get(key);
    if (!row) {
      row = { resource_type, resource_id, resource_name, assignments: [] };
      resourceMap.set(key, row);
    }
    return row;
  }

  if (input.resourceType === "event") {
    for (const c of crewBlocks) {
      const row = ensureResource(
        `event:${c.eventId}`,
        "event",
        c.eventId,
        c.eventName,
      );
      row.assignments.push(c.block);
    }
    for (const t of truckBlocks) {
      const row = ensureResource(
        `event:${t.eventId}`,
        "event",
        t.eventId,
        t.eventName,
      );
      row.assignments.push(t.block);
    }
  } else if (input.resourceType === "personnel") {
    for (const c of crewBlocks) {
      const row = ensureResource(
        `personnel:${c.personnelId}`,
        "personnel",
        c.personnelId,
        c.personnelName,
      );
      row.assignments.push(c.block);
    }
  } else {
    for (const t of truckBlocks) {
      const row = ensureResource(
        `truck:${t.truckId}`,
        "truck",
        t.truckId,
        t.truckName,
      );
      row.assignments.push(t.block);
    }
  }

  const resources = [...resourceMap.values()].sort((a, b) =>
    a.resource_name.localeCompare(b.resource_name),
  );

  const totalAssignments = resources.reduce((s, r) => s + r.assignments.length, 0);
  const conflictCount = await countActiveConflictsForTenant(pool, input.tenantId);

  const routeRows = await listTruckRoutesOverlappingDateRange(
    pool,
    input.tenantId,
    range.start,
    range.end,
  );
  const truck_route_blocks: ScheduleTruckRouteBlock[] = routeRows.map((r) => {
    const dep =
      r.departure_datetime instanceof Date
        ? r.departure_datetime.toISOString()
        : new Date(r.departure_datetime).toISOString();
    const eta =
      r.estimated_arrival instanceof Date
        ? r.estimated_arrival.toISOString()
        : new Date(r.estimated_arrival).toISOString();
    const start = r.event_start_date?.slice(0, 10) ?? "";
    let schedule_conflict_hint: string | null = null;
    if (start && eta.slice(0, 10) > start) {
      schedule_conflict_hint = `ETA (${eta.slice(0, 10)}) is after event start (${start}).`;
    }
    return {
      route_id: r.id,
      event_id: r.event_id,
      event_name: r.event_name ?? "",
      truck_id: r.truck_id,
      truck_name: r.truck_name ?? "",
      departure_datetime: dep,
      estimated_arrival: eta,
      status: r.status,
      schedule_conflict_hint,
    };
  });

  return {
    data: {
      view,
      range,
      resources,
    },
    meta: {
      total_assignments: totalAssignments,
      conflict_count: conflictCount,
      truck_route_blocks,
    },
  };
}
