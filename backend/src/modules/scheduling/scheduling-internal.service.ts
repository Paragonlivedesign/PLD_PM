import type {
  ConflictResponse,
  CrewAssignmentResponse,
  TruckAssignmentResponse,
} from "@pld/shared";
import { pool } from "../../db/pool.js";
import { getDayRate, getPerDiem } from "../personnel/index.js";
import {
  listCrewAssignmentsByEventId,
  listCrewAssignmentsByPersonnelInRange,
  mapCrewAssignmentRow,
} from "./crew-assignments.repository.js";
import {
  listConflicts,
  mapConflictRow,
  type ListConflictsParams,
} from "./conflicts.repository.js";
import {
  getTruckAssignmentsByEventId,
  listTruckAssignmentsOverlappingRange,
  mapTruckAssignmentRow,
} from "./truck-assignments.repository.js";

export async function getAssignmentsByEvent(
  eventId: string,
  tenantId: string,
  options?: {
    type?: "crew" | "truck" | "all";
    status?: string[];
    includeCancelled?: boolean;
  },
): Promise<{ crew: CrewAssignmentResponse[]; truck: TruckAssignmentResponse[] }> {
  const type = options?.type ?? "all";
  const st = options?.status;
  const inc = options?.includeCancelled ?? false;
  const crew: CrewAssignmentResponse[] = [];
  const truck: TruckAssignmentResponse[] = [];

  if (type === "crew" || type === "all") {
    const rows = await listCrewAssignmentsByEventId(pool, tenantId, eventId, st, inc);
    for (const r of rows) {
      const rates = await Promise.all([
        getDayRate(r.personnel_id, tenantId),
        getPerDiem(r.personnel_id, tenantId),
      ]);
      crew.push(mapCrewAssignmentRow(r, rates[0].day_rate, rates[1].per_diem));
    }
  }
  if (type === "truck" || type === "all") {
    const rows = await getTruckAssignmentsByEventId(pool, tenantId, eventId, st, inc);
    truck.push(...rows.map(mapTruckAssignmentRow));
  }
  return { crew, truck };
}

export async function getAssignmentsByPersonnel(
  personnelId: string,
  tenantId: string,
  options?: {
    date_range_start?: string;
    date_range_end?: string;
    status?: string[];
    includeCancelled?: boolean;
  },
): Promise<CrewAssignmentResponse[]> {
  const start = options?.date_range_start ?? "1970-01-01";
  const end = options?.date_range_end ?? "2099-12-31";
  const rows = await listCrewAssignmentsByPersonnelInRange(
    pool,
    tenantId,
    personnelId,
    start,
    end,
    options?.status,
    options?.includeCancelled ?? false,
  );
  const out: CrewAssignmentResponse[] = [];
  for (const r of rows) {
    const rates = await Promise.all([
      getDayRate(r.personnel_id, tenantId),
      getPerDiem(r.personnel_id, tenantId),
    ]);
    out.push(mapCrewAssignmentRow(r, rates[0].day_rate, rates[1].per_diem));
  }
  return out;
}

export async function getAssignmentsByTruck(
  truckId: string,
  tenantId: string,
  options?: {
    date_range_start?: string;
    date_range_end?: string;
    status?: string[];
    includeCancelled?: boolean;
  },
): Promise<TruckAssignmentResponse[]> {
  const raw = await listTruckAssignmentsOverlappingRange(
    pool,
    tenantId,
    options?.date_range_start ?? "1970-01-01",
    options?.date_range_end ?? "2099-12-31",
    {
      truckId,
      status: options?.status,
      includeCancelled: options?.includeCancelled,
    },
  );
  return raw.map(mapTruckAssignmentRow);
}

export async function getConflicts(
  tenantId: string,
  options?: {
    resource_type?: "personnel" | "truck";
    resource_id?: string;
    event_id?: string;
    severity?: "hard" | "soft";
    status?: ("active" | "resolved" | "dismissed")[];
  },
): Promise<ConflictResponse[]> {
  const p: ListConflictsParams = {
    tenantId,
    resourceType: options?.resource_type,
    resourceId: options?.resource_id,
    eventId: options?.event_id,
    status: options?.status,
    severity: options?.severity ? [options.severity] : undefined,
    limit: 5000,
    cursorId: null,
  };
  const raw = await listConflicts(pool, p);
  return raw.map(mapConflictRow);
}

export async function getAssignmentDays(
  eventId: string,
  tenantId: string,
  options?: { type?: "crew" | "truck" | "all" },
): Promise<{
  event_id: string;
  crew: {
    total_days: number;
    total_day_rate_cost: number;
    total_per_diem_cost: number;
    assignment_count: number;
  };
  truck: {
    total_days: number;
    assignment_count: number;
    /** Sum of assignment day-span × truck `daily_rate` when rate is set */
    total_daily_rate_cost: number;
  };
}> {
  const type = options?.type ?? "all";
  let crewDays = 0;
  let crewCost = 0;
  let crewPerDiem = 0;
  let crewCount = 0;
  let truckDays = 0;
  let truckCount = 0;
  let truckFleetCost = 0;

  if (type === "crew" || type === "all") {
    const rows = await listCrewAssignmentsByEventId(pool, tenantId, eventId, undefined, false);
    for (const r of rows) {
      const rates = await Promise.all([
        getDayRate(r.personnel_id, tenantId),
        getPerDiem(r.personnel_id, tenantId),
      ]);
      const mapped = mapCrewAssignmentRow(r, rates[0].day_rate, rates[1].per_diem);
      crewDays += mapped.total_days;
      crewCost += Number(mapped.total_cost);
      crewPerDiem += Number(mapped.total_per_diem);
      crewCount += 1;
    }
  }
  if (type === "truck" || type === "all") {
    const rows = await getTruckAssignmentsByEventId(pool, tenantId, eventId, undefined, false);
    for (const r of rows) {
      const mapped = mapTruckAssignmentRow(r);
      truckDays += mapped.total_days;
      truckCount += 1;
      const rate = r.truck_daily_rate != null ? Number(r.truck_daily_rate) : 0;
      if (!Number.isNaN(rate) && rate > 0) {
        truckFleetCost += mapped.total_days * rate;
      }
    }
  }

  return {
    event_id: eventId,
    crew: {
      total_days: crewDays,
      total_day_rate_cost: crewCost,
      total_per_diem_cost: crewPerDiem,
      assignment_count: crewCount,
    },
    truck: {
      total_days: truckDays,
      assignment_count: truckCount,
      total_daily_rate_cost: truckFleetCost,
    },
  };
}
