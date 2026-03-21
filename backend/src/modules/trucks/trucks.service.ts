import type {
  RouteLocationRef,
  TruckAssignmentResponse,
  TruckResponse,
  TruckRoutePublicResponse,
  TruckRouteResponse,
} from "@pld/shared";
import { randomBytes } from "node:crypto";
import { TRUCK_TYPES, TRUCK_STATUSES } from "@pld/shared";
import { pool } from "../../db/pool.js";
import { domainBus } from "../../domain/bus.js";
import { newId } from "../../utils/ids.js";
import { eachDateInclusive, rangesOverlap } from "../../utils/dates.js";
import { countActiveFutureAssignmentsForTruck } from "../scheduling/truck-assignments.repository.js";
import {
  countTrucks,
  decodeListCursor,
  encodeListCursor,
  findDuplicateNameOrPlate,
  getTruckRowById,
  insertTruck,
  listTrucks,
  mapTruckRow,
  retireTruck,
  updateTruckPartial,
  type ListTrucksParams,
} from "./trucks.repository.js";
import {
  getAssignmentsForTruckInRange,
  getTruckAssignmentsByEventId,
  mapTruckAssignmentRow,
} from "../scheduling/truck-assignments.repository.js";
import {
  createTruckAssignmentApi,
  listTruckAssignmentsApi,
} from "../scheduling/truck-assignments.service.js";
import {
  countTruckRoutes,
  getTruckRouteById,
  getTruckRouteByShareToken,
  insertTruckRoute,
  listRoutesByEvent,
  listTruckRoutes,
  listTruckRoutesOverlappingDateRange,
  mapTruckRouteRow,
  setDriverShareToken,
  updateTruckRoutePartial,
  type DbTruckRouteRow,
} from "./truck-routes.repository.js";
import {
  parseRouteLocationRef,
  refToJson,
  resolveRouteLocationCoordinate,
  resolveRouteLocationLabel,
} from "./route-location.js";
import { computeRouteDirections, type LatLng } from "./route-directions.js";
import { getEventById } from "../events/repository.js";

function isTruckType(s: string): s is (typeof TRUCK_TYPES)[number] {
  return (TRUCK_TYPES as readonly string[]).includes(s);
}

function isTruckStatus(s: string): s is (typeof TRUCK_STATUSES)[number] {
  return (TRUCK_STATUSES as readonly string[]).includes(s);
}

const ROUTE_STATUSES = ["planned", "in_transit", "completed", "cancelled"] as const;

function isRouteStatus(s: string): s is (typeof ROUTE_STATUSES)[number] {
  return (ROUTE_STATUSES as readonly string[]).includes(s);
}

function publicBaseUrl(): string {
  return (process.env.PLD_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

function shareUrlForToken(token: string | null): string | null {
  if (!token) return null;
  const path = `/api/v1/truck-routes/public/${token}`;
  const base = publicBaseUrl();
  return base ? `${base}${path}` : path;
}

async function scheduleConflictHint(
  tenantId: string,
  eventId: string,
  estimatedArrivalIso: string,
): Promise<string | null> {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) return null;
  const etaDay = estimatedArrivalIso.slice(0, 10);
  if (etaDay > ev.start_date) {
    return `ETA (${etaDay}) is after event start date (${ev.start_date}).`;
  }
  return null;
}

export async function enrichTruckRouteResponse(row: DbTruckRouteRow): Promise<TruckRouteResponse> {
  const mapped = mapTruckRouteRow(row);
  const hint = await scheduleConflictHint(row.tenant_id, row.event_id, mapped.estimated_arrival);
  return mapTruckRouteRow(row, {
    driver_share_url: shareUrlForToken(row.driver_share_token),
    schedule_conflict_hint: hint,
  });
}

async function normalizeWaypointBatch(
  tenantId: string,
  raw: unknown,
): Promise<unknown[]> {
  if (!Array.isArray(raw)) return [];
  const out: unknown[] = [];
  for (const item of raw) {
    const w = item as Record<string, unknown>;
    const lr = parseRouteLocationRef(w.location_ref);
    let location = String(w.location ?? "");
    if (lr) {
      location = await resolveRouteLocationLabel(pool, tenantId, lr);
    }
    out.push({
      ...w,
      location,
      location_ref: lr ? refToJson(lr) : (w.location_ref as object) ?? {},
    });
  }
  return out;
}

export async function listTruckRoutesApi(q: {
  tenantId: string;
  eventId?: string;
  truckId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  limit: number;
  cursor: string | null;
}): Promise<{
  data: TruckRouteResponse[];
  meta: { cursor: string | null; has_more: boolean; total_count: number };
}> {
  const offset = decodeListCursor(q.cursor);
  const p = {
    tenantId: q.tenantId,
    eventId: q.eventId,
    truckId: q.truckId,
    dateRangeStart: q.dateRangeStart,
    dateRangeEnd: q.dateRangeEnd,
    limit: q.limit + 1,
    offset,
  };
  const total = await countTruckRoutes(pool, p);
  const rows = await listTruckRoutes(pool, p);
  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const data = await Promise.all(slice.map((r) => enrichTruckRouteResponse(r)));
  return {
    data,
    meta: {
      cursor: hasMore ? encodeListCursor(offset + q.limit) : null,
      has_more: hasMore,
      total_count: total,
    },
  };
}

export async function createTruck(input: {
  tenantId: string;
  userId: string;
  body: Record<string, unknown>;
}): Promise<
  | { ok: true; data: TruckResponse }
  | { ok: false; status: 400 | 409; errors: { code: string; message: string }[] }
> {
  const name = String(input.body.name ?? "").trim();
  const type = String(input.body.type ?? "");
  if (!name || name.length > 100) {
    return {
      ok: false,
      status: 400,
      errors: [{ code: "validation", message: "name is required (1–100 chars)" }],
    };
  }
  if (!isTruckType(type)) {
    return { ok: false, status: 400, errors: [{ code: "validation", message: "invalid type" }] };
  }
  const statusRaw = input.body.status != null ? String(input.body.status) : "available";
  if (!isTruckStatus(statusRaw)) {
    return { ok: false, status: 400, errors: [{ code: "validation", message: "invalid status" }] };
  }
  const licensePlate =
    input.body.license_plate != null ? String(input.body.license_plate).trim() || null : null;
  const dup = await findDuplicateNameOrPlate(pool, input.tenantId, name, licensePlate);
  if (dup === "name") {
    return {
      ok: false,
      status: 409,
      errors: [{ code: "duplicate_name", message: "Name already exists" }],
    };
  }
  if (dup === "plate") {
    return {
      ok: false,
      status: 409,
      errors: [{ code: "duplicate_plate", message: "License plate already exists" }],
    };
  }

  const id = newId();
  const data = await insertTruck(pool, {
    id,
    tenantId: input.tenantId,
    name,
    type,
    licensePlate,
    vin: input.body.vin != null ? String(input.body.vin) : null,
    capacityCubicFt:
      input.body.capacity_cubic_ft != null ? Number(input.body.capacity_cubic_ft) : null,
    capacityLbs: input.body.capacity_lbs != null ? Number(input.body.capacity_lbs) : null,
    homeBase: input.body.home_base != null ? String(input.body.home_base) : null,
    status: statusRaw,
    dailyRate: input.body.daily_rate != null ? Number(input.body.daily_rate) : null,
    mileageRate: input.body.mileage_rate != null ? Number(input.body.mileage_rate) : null,
    currentMileage:
      input.body.current_mileage != null ? Number(input.body.current_mileage) : null,
    insuranceExpiry:
      input.body.insurance_expiry != null ? String(input.body.insurance_expiry).slice(0, 10) : null,
    inspectionExpiry:
      input.body.inspection_expiry != null
        ? String(input.body.inspection_expiry).slice(0, 10)
        : null,
    notes: input.body.notes != null ? String(input.body.notes) : null,
    metadata:
      input.body.metadata && typeof input.body.metadata === "object"
        ? (input.body.metadata as Record<string, unknown>)
        : {},
  });

  domainBus.emit("truck.created", { truck_id: data.id, tenant_id: input.tenantId });

  return { ok: true, data };
}

export async function listTrucksApi(q: {
  tenantId: string;
  type?: string[];
  status?: string[];
  home_base?: string;
  min_capacity_cubic_ft?: number;
  min_capacity_lbs?: number;
  search?: string;
  sort_by: ListTrucksParams["sortBy"];
  sort_order: "asc" | "desc";
  limit: number;
  cursor: string | null;
}): Promise<{
  data: TruckResponse[];
  meta: { cursor: string | null; has_more: boolean; total_count: number };
}> {
  const offset = decodeListCursor(q.cursor);
  const p: ListTrucksParams = {
    tenantId: q.tenantId,
    type: q.type,
    status: q.status,
    homeBase: q.home_base,
    minCapacityCubicFt: q.min_capacity_cubic_ft,
    minCapacityLbs: q.min_capacity_lbs,
    search: q.search,
    sortBy: q.sort_by,
    sortOrder: q.sort_order,
    limit: q.limit,
    offset,
  };
  const total = await countTrucks(pool, {
    tenantId: p.tenantId,
    type: p.type,
    status: p.status,
    homeBase: p.homeBase,
    minCapacityCubicFt: p.minCapacityCubicFt,
    minCapacityLbs: p.minCapacityLbs,
    search: p.search,
  });
  const rows = await listTrucks(pool, p);
  const hasMore = rows.length > q.limit;
  const slice = hasMore ? rows.slice(0, q.limit) : rows;
  const nextCursor = hasMore ? encodeListCursor(offset + q.limit) : null;
  return {
    data: slice.map(mapTruckRow),
    meta: {
      cursor: nextCursor,
      has_more: hasMore,
      total_count: total,
    },
  };
}

export async function getTruck(
  tenantId: string,
  id: string,
): Promise<TruckResponse | null> {
  const row = await getTruckRowById(pool, tenantId, id);
  return row ? mapTruckRow(row) : null;
}

export async function updateTruck(input: {
  tenantId: string;
  userId: string;
  id: string;
  body: Record<string, unknown>;
}): Promise<
  | { ok: true; data: TruckResponse }
  | { ok: false; status: 400 | 404 | 409; errors: { code: string; message: string }[] }
> {
  const cur = await getTruckRowById(pool, input.tenantId, input.id);
  if (!cur) {
    return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  }
  const name =
    input.body.name != null ? String(input.body.name).trim() : undefined;
  if (name !== undefined && (!name || name.length > 100)) {
    return {
      ok: false,
      status: 400,
      errors: [{ code: "validation", message: "invalid name" }],
    };
  }
  const licensePlate =
    input.body.license_plate !== undefined
      ? input.body.license_plate === null
        ? null
        : String(input.body.license_plate).trim() || null
      : undefined;
  const dup = await findDuplicateNameOrPlate(
    pool,
    input.tenantId,
    name ?? cur.name,
    licensePlate !== undefined ? licensePlate : cur.license_plate,
    input.id,
  );
  if (dup === "name") {
    return {
      ok: false,
      status: 409,
      errors: [{ code: "duplicate_name", message: "Name already exists" }],
    };
  }
  if (dup === "plate") {
    return {
      ok: false,
      status: 409,
      errors: [{ code: "duplicate_plate", message: "License plate already exists" }],
    };
  }

  const patch: Parameters<typeof updateTruckPartial>[3] = {};
  if (name !== undefined) patch.name = name;
  if (input.body.type != null) {
    const t = String(input.body.type);
    if (!isTruckType(t)) {
      return { ok: false, status: 400, errors: [{ code: "validation", message: "invalid type" }] };
    }
    patch.type = t;
  }
  if (licensePlate !== undefined) patch.license_plate = licensePlate;
  if (input.body.vin !== undefined) patch.vin = input.body.vin === null ? null : String(input.body.vin);
  if (input.body.capacity_cubic_ft !== undefined) {
    patch.capacity_cubic_ft =
      input.body.capacity_cubic_ft === null ? null : Number(input.body.capacity_cubic_ft);
  }
  if (input.body.capacity_lbs !== undefined) {
    patch.capacity_lbs =
      input.body.capacity_lbs === null ? null : Number(input.body.capacity_lbs);
  }
  if (input.body.home_base !== undefined) {
    patch.home_base = input.body.home_base === null ? null : String(input.body.home_base);
  }
  if (input.body.status != null) {
    const s = String(input.body.status);
    if (!isTruckStatus(s)) {
      return {
        ok: false,
        status: 400,
        errors: [{ code: "validation", message: "invalid status" }],
      };
    }
    patch.status = s;
  }
  if (input.body.daily_rate !== undefined) {
    patch.daily_rate =
      input.body.daily_rate === null ? null : Number(input.body.daily_rate);
  }
  if (input.body.mileage_rate !== undefined) {
    patch.mileage_rate =
      input.body.mileage_rate === null ? null : Number(input.body.mileage_rate);
  }
  if (input.body.current_mileage !== undefined) {
    patch.current_mileage =
      input.body.current_mileage === null ? null : Number(input.body.current_mileage);
  }
  if (input.body.insurance_expiry !== undefined) {
    patch.insurance_expiry =
      input.body.insurance_expiry === null
        ? null
        : String(input.body.insurance_expiry).slice(0, 10);
  }
  if (input.body.inspection_expiry !== undefined) {
    patch.inspection_expiry =
      input.body.inspection_expiry === null
        ? null
        : String(input.body.inspection_expiry).slice(0, 10);
  }
  if (input.body.notes !== undefined) {
    patch.notes = input.body.notes === null ? null : String(input.body.notes);
  }
  if (input.body.metadata !== undefined && typeof input.body.metadata === "object") {
    const existing =
      cur.metadata && typeof cur.metadata === "object"
        ? (cur.metadata as Record<string, unknown>)
        : {};
    patch.metadata = { ...existing, ...(input.body.metadata as Record<string, unknown>) };
  }

  const data = await updateTruckPartial(pool, input.tenantId, input.id, patch);
  if (!data) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };

  domainBus.emit("truck.updated", {
    truck_id: data.id,
    tenant_id: input.tenantId,
    changedFields: Object.keys(patch),
  });

  return { ok: true, data };
}

export async function retireTruckApi(
  tenantId: string,
  id: string,
): Promise<
  | { ok: true; data: { id: string; status: string; retired_at: string } }
  | { ok: false; status: 404 | 409; errors: { code: string; message: string }[] }
> {
  const today = new Date().toISOString().slice(0, 10);
  const n = await countActiveFutureAssignmentsForTruck(pool, tenantId, id, today);
  if (n > 0) {
    return {
      ok: false,
      status: 409,
      errors: [
        {
          code: "has_active_assignments",
          message: "Truck has active future assignments",
        },
      ],
    };
  }
  const row = await getTruckRowById(pool, tenantId, id);
  if (!row) {
    return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  }
  const data = await retireTruck(pool, tenantId, id);
  if (!data) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };

  domainBus.emit("truck.status_changed", {
    truck_id: id,
    tenant_id: tenantId,
    old_status: row.status,
    new_status: "retired",
  });

  return { ok: true, data };
}

export async function createAssignmentViaTruck(input: {
  tenantId: string;
  userId: string;
  truckId: string;
  body: Record<string, unknown>;
}) {
  const eventId = String(input.body.event_id ?? "");
  const startDate = String(input.body.start_date ?? "").slice(0, 10);
  const endDate = String(input.body.end_date ?? "").slice(0, 10);
  return createTruckAssignmentApi({
    tenantId: input.tenantId,
    userId: input.userId,
    eventId,
    truckId: input.truckId,
    purpose: input.body.purpose != null ? String(input.body.purpose) : null,
    startDate,
    endDate,
    driverId: input.body.driver_id != null ? String(input.body.driver_id) : null,
    notes: input.body.notes != null ? String(input.body.notes) : null,
    status:
      input.body.status != null ? String(input.body.status) : "tentative",
  });
}

export async function listAssignmentsForTruck(input: {
  tenantId: string;
  truckId: string;
  date_range_start?: string;
  date_range_end?: string;
  status?: string[];
  limit: number;
  cursor: string | null;
}) {
  return listTruckAssignmentsApi({
    tenantId: input.tenantId,
    truckId: input.truckId,
    dateRangeStart: input.date_range_start,
    dateRangeEnd: input.date_range_end,
    status: input.status,
    limit: input.limit,
    cursorId: input.cursor,
  });
}

export async function getTruckAvailability(
  tenantId: string,
  truckId: string,
  start: string,
  end: string,
): Promise<{
  truck_id: string;
  truck_name: string;
  status: string;
  range: { start: string; end: string };
  days: {
    date: string;
    available: boolean;
    assignment: {
      assignment_id: string;
      event_id: string;
      event_name: string;
      purpose: string | null;
      status: string;
    } | null;
  }[];
  summary: {
    total_days: number;
    available_days: number;
    assigned_days: number;
  };
} | null> {
  const truck = await getTruckRowById(pool, tenantId, truckId);
  if (!truck) return null;
  const assignments = await getAssignmentsForTruckInRange(
    pool,
    tenantId,
    truckId,
    start,
    end,
  );
  const days = eachDateInclusive(start, end);
  let availableDays = 0;
  let assignedDays = 0;
  const outDays = days.map((date) => {
    if (truck.status === "maintenance" || truck.status === "retired") {
      return {
        date,
        available: false,
        assignment: null,
      };
    }
    const hit = assignments.find((a) =>
      rangesOverlap(
        date,
        date,
        a.start_date.toString().slice(0, 10),
        a.end_date.toString().slice(0, 10),
      ),
    );
    if (hit && hit.status !== "cancelled") {
      assignedDays++;
      return {
        date,
        available: false,
        assignment: {
          assignment_id: hit.id,
          event_id: hit.event_id,
          event_name: hit.event_name ?? "",
          purpose: hit.purpose,
          status: hit.status,
        },
      };
    }
    availableDays++;
    return { date, available: true, assignment: null };
  });

  return {
    truck_id: truck.id,
    truck_name: truck.name,
    status: truck.status,
    range: { start, end },
    days: outDays,
    summary: {
      total_days: days.length,
      available_days: availableDays,
      assigned_days: assignedDays,
    },
  };
}

export async function getTruckRoutesForEvent(
  tenantId: string,
  eventId: string,
): Promise<{
  data: { event_id: string; event_name: string; routes: TruckRouteResponse[] };
  meta: {
    total_routes: number;
    total_distance_miles: string | null;
    total_estimated_cost: string | null;
    currency: string;
  };
} | null> {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) return null;
  const rows = await listRoutesByEvent(pool, tenantId, eventId);
  const routes = await Promise.all(rows.map((r) => enrichTruckRouteResponse(r)));
  let sumDist = 0;
  let sumCost = 0;
  for (const r of rows) {
    if (r.distance_miles) sumDist += Number(r.distance_miles);
    if (r.estimated_fuel_cost) sumCost += Number(r.estimated_fuel_cost);
  }
  return {
    data: {
      event_id: eventId,
      event_name: ev.name,
      routes,
    },
    meta: {
      total_routes: routes.length,
      total_distance_miles: routes.length ? String(sumDist) : null,
      total_estimated_cost: routes.length ? String(sumCost) : null,
      currency: "USD",
    },
  };
}

export async function createTruckRouteApi(input: {
  tenantId: string;
  userId: string;
  body: Record<string, unknown>;
}): Promise<
  | { ok: true; data: TruckRouteResponse }
  | { ok: false; status: 400 | 404; errors: { code: string; message: string }[] }
> {
  const eventId = String(input.body.event_id ?? "");
  const truckId = String(input.body.truck_id ?? "");
  const ev = await getEventById(pool, input.tenantId, eventId);
  if (!ev) {
    return { ok: false, status: 404, errors: [{ code: "not_found", message: "Event not found" }] };
  }
  const tk = await getTruckRowById(pool, input.tenantId, truckId);
  if (!tk) {
    return { ok: false, status: 404, errors: [{ code: "not_found", message: "Truck not found" }] };
  }

  const originRef = parseRouteLocationRef(input.body.origin_ref);
  const destRef = parseRouteLocationRef(input.body.destination_ref);
  let origin = String(input.body.origin ?? "").trim();
  let destination = String(input.body.destination ?? "").trim();
  if (originRef) {
    origin = await resolveRouteLocationLabel(pool, input.tenantId, originRef);
  }
  if (destRef) {
    destination = await resolveRouteLocationLabel(pool, input.tenantId, destRef);
  }
  const metaRaw =
    input.body.metadata && typeof input.body.metadata === "object"
      ? (input.body.metadata as Record<string, unknown>)
      : {};
  const singleStop = metaRaw.route_pattern === "single_stop";
  if (singleStop) {
    destination = origin;
  }
  if (!destination) destination = origin;
  if (!origin.trim()) {
    return {
      ok: false,
      status: 400,
      errors: [{ code: "validation", message: "origin (or origin_ref) required" }],
    };
  }
  if (!destination.trim()) {
    return {
      ok: false,
      status: 400,
      errors: [{ code: "validation", message: "destination (or destination_ref) required" }],
    };
  }

  const waypoints = await normalizeWaypointBatch(input.tenantId, input.body.waypoints);

  const statusRaw = input.body.status != null ? String(input.body.status) : "planned";
  if (!isRouteStatus(statusRaw)) {
    return { ok: false, status: 400, errors: [{ code: "validation", message: "invalid status" }] };
  }

  const id = newId();
  const row = await insertTruckRoute(pool, {
    id,
    tenantId: input.tenantId,
    eventId,
    truckId,
    assignmentId:
      input.body.assignment_id != null ? String(input.body.assignment_id) : null,
    driverId: input.body.driver_id != null ? String(input.body.driver_id) : null,
    origin,
    destination,
    originRef: originRef ? refToJson(originRef) : {},
    destinationRef: destRef ? refToJson(destRef) : {},
    waypoints,
    departureDatetime: String(input.body.departure_datetime ?? ""),
    estimatedArrival: String(input.body.estimated_arrival ?? ""),
    distanceMiles:
      input.body.distance_miles != null ? Number(input.body.distance_miles) : null,
    estimatedFuelCost:
      input.body.estimated_fuel_cost != null
        ? Number(input.body.estimated_fuel_cost)
        : null,
    cargoDescription:
      input.body.cargo_description != null ? String(input.body.cargo_description) : null,
    notes: input.body.notes != null ? String(input.body.notes) : null,
    metadata: metaRaw,
    status: statusRaw,
  });
  const data = await enrichTruckRouteResponse(row);
  domainBus.emit("route.created", {
    route_id: data.id,
    tenant_id: input.tenantId,
    event_id: data.event_id,
    truck_id: data.truck_id,
    driver_id: data.driver_id,
    origin: data.origin,
    destination: data.destination,
    departure_datetime: data.departure_datetime,
    distance_miles: data.distance_miles,
    estimated_fuel_cost: data.estimated_fuel_cost,
    waypoint_count: data.waypoints.length,
    created_by: input.userId,
    created_at: new Date().toISOString(),
  });
  return { ok: true, data };
}

export async function updateTruckRouteApi(input: {
  tenantId: string;
  userId: string;
  id: string;
  body: Record<string, unknown>;
}): Promise<
  | { ok: true; data: TruckRouteResponse }
  | { ok: false; status: 404; errors: { code: string; message: string }[] }
> {
  const patch: Parameters<typeof updateTruckRoutePartial>[3] = {};
  if (input.body.driver_id !== undefined) {
    patch.driver_id =
      input.body.driver_id === null ? null : String(input.body.driver_id);
  }
  if (input.body.origin !== undefined) patch.origin = String(input.body.origin);
  if (input.body.destination !== undefined) {
    patch.destination = String(input.body.destination);
  }
  if (input.body.origin_ref !== undefined) {
    const lr = parseRouteLocationRef(input.body.origin_ref);
    if (lr) {
      patch.origin = await resolveRouteLocationLabel(pool, input.tenantId, lr);
      patch.origin_ref = refToJson(lr);
    }
  }
  if (input.body.destination_ref !== undefined) {
    const lr = parseRouteLocationRef(input.body.destination_ref);
    if (lr) {
      patch.destination = await resolveRouteLocationLabel(pool, input.tenantId, lr);
      patch.destination_ref = refToJson(lr);
    }
  }
  if (input.body.waypoints !== undefined) {
    patch.waypoints = await normalizeWaypointBatch(input.tenantId, input.body.waypoints);
  }
  if (input.body.departure_datetime !== undefined) {
    patch.departure_datetime = String(input.body.departure_datetime);
  }
  if (input.body.estimated_arrival !== undefined) {
    patch.estimated_arrival = String(input.body.estimated_arrival);
  }
  if (input.body.actual_arrival !== undefined) {
    patch.actual_arrival =
      input.body.actual_arrival === null ? null : String(input.body.actual_arrival);
  }
  if (input.body.distance_miles !== undefined) {
    patch.distance_miles =
      input.body.distance_miles === null ? null : Number(input.body.distance_miles);
  }
  if (input.body.actual_distance_miles !== undefined) {
    patch.actual_distance_miles =
      input.body.actual_distance_miles === null
        ? null
        : Number(input.body.actual_distance_miles);
  }
  if (input.body.estimated_fuel_cost !== undefined) {
    patch.estimated_fuel_cost =
      input.body.estimated_fuel_cost === null
        ? null
        : Number(input.body.estimated_fuel_cost);
  }
  if (input.body.actual_fuel_cost !== undefined) {
    patch.actual_fuel_cost =
      input.body.actual_fuel_cost === null ? null : Number(input.body.actual_fuel_cost);
  }
  if (input.body.cargo_description !== undefined) {
    patch.cargo_description =
      input.body.cargo_description === null
        ? null
        : String(input.body.cargo_description);
  }
  if (input.body.notes !== undefined) {
    patch.notes = input.body.notes === null ? null : String(input.body.notes);
  }
  if (input.body.metadata !== undefined && typeof input.body.metadata === "object") {
    const cur = await pool
      .query<DbTruckRouteRow>(`SELECT metadata FROM truck_routes WHERE tenant_id = $1 AND id = $2`, [
        input.tenantId,
        input.id,
      ])
      .then((r) => r.rows[0]);
    const prev =
      cur?.metadata && typeof cur.metadata === "object"
        ? (cur.metadata as Record<string, unknown>)
        : {};
    patch.metadata = { ...prev, ...(input.body.metadata as Record<string, unknown>) };
  }
  if (input.body.status !== undefined) patch.status = String(input.body.status);

  const row = await updateTruckRoutePartial(pool, input.tenantId, input.id, patch);
  if (!row) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  const data = await enrichTruckRouteResponse(row);
  domainBus.emit("route.updated", {
    route_id: data.id,
    tenant_id: input.tenantId,
    event_id: data.event_id,
    truck_id: data.truck_id,
    changed_fields: Object.keys(patch),
    updated_by: input.userId,
    updated_at: new Date().toISOString(),
  });
  return { ok: true, data };
}

async function collectRoutePoints(tenantId: string, row: DbTruckRouteRow): Promise<LatLng[]> {
  const points: LatLng[] = [];
  const pushCoord = (lat: number, lng: number) => {
    points.push({ lat, lng });
  };
  const oRef = parseRouteLocationRef(row.origin_ref);
  const oCoord = oRef
    ? await resolveRouteLocationCoordinate(pool, tenantId, oRef)
    : null;
  if (oCoord) pushCoord(oCoord.lat, oCoord.lng);
  else {
    const m = String(row.origin).match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (m) pushCoord(Number(m[1]), Number(m[2]));
  }
  const wps = Array.isArray(row.waypoints) ? row.waypoints : [];
  for (const w of wps) {
    const o = w as Record<string, unknown>;
    const lr = parseRouteLocationRef(o.location_ref);
    const c = lr ? await resolveRouteLocationCoordinate(pool, tenantId, lr) : null;
    if (c) pushCoord(c.lat, c.lng);
    else if (typeof o.location === "string") {
      const m = o.location.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
      if (m) pushCoord(Number(m[1]), Number(m[2]));
    }
  }
  const dRef = parseRouteLocationRef(row.destination_ref);
  const dCoord = dRef
    ? await resolveRouteLocationCoordinate(pool, tenantId, dRef)
    : null;
  if (dCoord) pushCoord(dCoord.lat, dCoord.lng);
  else {
    const m = String(row.destination).match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (m) pushCoord(Number(m[1]), Number(m[2]));
  }
  if (points.length === 1) {
    points.push(points[0]);
  }
  return points;
}

function delayThresholdMinutes(): number {
  const n = Number(process.env.PLD_ROUTE_DELAY_NOTIFY_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

export async function computeTruckRouteApi(input: {
  tenantId: string;
  userId: string;
  id: string;
}): Promise<
  | { ok: true; data: TruckRouteResponse }
  | { ok: false; status: 404; errors: { code: string; message: string }[] }
> {
  const withNames = await getTruckRouteById(pool, input.tenantId, input.id);
  if (!withNames) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };

  const prevEta =
    withNames.estimated_arrival instanceof Date
      ? withNames.estimated_arrival.toISOString()
      : new Date(withNames.estimated_arrival).toISOString();

  const points = await collectRoutePoints(input.tenantId, withNames);
  const { distanceMiles, durationSeconds, geometry } = await computeRouteDirections(points);

  const dep =
    withNames.departure_datetime instanceof Date
      ? withNames.departure_datetime
      : new Date(withNames.departure_datetime);
  const newEta = new Date(dep.getTime() + durationSeconds * 1000);

  const geomPayload = {
    encoded_polyline: geometry.encoded_polyline,
    geojson: geometry.geojson,
    provider: geometry.provider,
    computed_at: geometry.computed_at,
    legs: geometry.legs,
    traffic_aware: geometry.traffic_aware === true,
  };

  const updated = await updateTruckRoutePartial(pool, input.tenantId, input.id, {
    distance_miles: distanceMiles,
    estimated_arrival: newEta.toISOString(),
    route_geometry: geomPayload,
    traffic_aware: geometry.traffic_aware === true,
    provider_computed_at: geometry.computed_at,
  });
  if (!updated) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  const full = await getTruckRouteById(pool, input.tenantId, input.id);
  if (!full) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  const data = await enrichTruckRouteResponse(full);

  const prevMs = new Date(prevEta).getTime();
  const newMs = new Date(data.estimated_arrival).getTime();
  const delayMin = Math.max(0, Math.round((newMs - prevMs) / 60000));

  domainBus.emit("route.eta_updated", {
    route_id: data.id,
    tenant_id: input.tenantId,
    event_id: data.event_id,
    truck_id: data.truck_id,
    previous_estimated_arrival: prevEta,
    new_estimated_arrival: data.estimated_arrival,
    source: "compute_route",
    updated_at: new Date().toISOString(),
  });

  const th = delayThresholdMinutes();
  if (delayMin >= th) {
    domainBus.emit("route.delay_threshold_exceeded", {
      route_id: data.id,
      tenant_id: input.tenantId,
      event_id: data.event_id,
      truck_id: data.truck_id,
      delay_minutes: delayMin,
      threshold_minutes: th,
      estimated_arrival: data.estimated_arrival,
      detected_at: new Date().toISOString(),
    });
  }

  return { ok: true, data };
}

export async function refreshTruckRouteEtaApi(input: {
  tenantId: string;
  userId: string;
  id: string;
}): Promise<
  | { ok: true; data: TruckRouteResponse }
  | { ok: false; status: 404; errors: { code: string; message: string }[] }
> {
  return computeTruckRouteApi(input);
}

export async function mintTruckRouteShareApi(input: {
  tenantId: string;
  id: string;
  body: Record<string, unknown>;
}): Promise<
  | { ok: true; data: { share_url: string; expires_at: string } }
  | { ok: false; status: 404; errors: { code: string; message: string }[] }
> {
  const row = await getTruckRouteById(pool, input.tenantId, input.id);
  if (!row) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  let ttl = Number(input.body.ttl_hours ?? 72);
  if (!Number.isFinite(ttl) || ttl < 1) ttl = 72;
  if (ttl > 168) ttl = 168;
  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + ttl * 3600 * 1000);
  const next = await setDriverShareToken(pool, input.tenantId, input.id, token, expires);
  if (!next) return { ok: false, status: 404, errors: [{ code: "not_found", message: "Not found" }] };
  const url = shareUrlForToken(token) ?? `/api/v1/truck-routes/public/${token}`;
  return {
    ok: true,
    data: { share_url: url, expires_at: expires.toISOString() },
  };
}

export async function getTruckRoutePublicByToken(
  token: string,
): Promise<{ ok: true; data: TruckRoutePublicResponse } | { ok: false; status: 404 }> {
  const row = await getTruckRouteByShareToken(pool, token);
  if (!row) return { ok: false, status: 404 };
  const mapped = mapTruckRouteRow(row);
  const pub: TruckRoutePublicResponse = {
    id: mapped.id,
    event_name: mapped.event_name,
    truck_name: mapped.truck_name,
    origin: mapped.origin,
    destination: mapped.destination,
    waypoints: mapped.waypoints,
    departure_datetime: mapped.departure_datetime,
    estimated_arrival: mapped.estimated_arrival,
    route_geometry: mapped.route_geometry,
    status: mapped.status,
    driver_share_expires_at: mapped.driver_share_expires_at,
  };
  return { ok: true, data: pub };
}

/** Internal: other modules import from trucks/index.ts */
export async function getTruckByIdInternal(
  truckId: string,
  tenantId: string,
  options?: { include_retired?: boolean },
): Promise<TruckResponse | null> {
  const row = await getTruckRowById(pool, tenantId, truckId);
  if (!row) return null;
  if (row.status === "retired" && !options?.include_retired) return null;
  return mapTruckRow(row);
}

export async function getAvailableTrucksInternal(
  tenantId: string,
  startDate: string,
  endDate: string,
  options?: {
    type?: string[];
    min_capacity_cubic_ft?: number;
    min_capacity_lbs?: number;
    home_base?: string;
  },
): Promise<TruckResponse[]> {
  const p: ListTrucksParams = {
    tenantId,
    type: options?.type,
    status: ["available", "in_use"],
    homeBase: options?.home_base,
    minCapacityCubicFt: options?.min_capacity_cubic_ft,
    minCapacityLbs: options?.min_capacity_lbs,
    sortBy: "name",
    sortOrder: "asc",
    limit: 500,
    offset: 0,
  };
  const rows = await listTrucks(pool, p);
  const out: TruckResponse[] = [];
  for (const row of rows) {
    if (row.status === "maintenance" || row.status === "retired") continue;
    const overlaps = await getAssignmentsForTruckInRange(
      pool,
      tenantId,
      row.id,
      startDate,
      endDate,
    );
    const busy = overlaps.some((a) => a.status !== "cancelled");
    if (!busy) out.push(mapTruckRow(row));
  }
  return out;
}

export async function getTruckAssignmentsByEventInternal(
  eventId: string,
  tenantId: string,
  options?: { status?: string[]; include_cancelled?: boolean },
): Promise<TruckAssignmentResponse[]> {
  const rows = await getTruckAssignmentsByEventId(
    pool,
    tenantId,
    eventId,
    options?.status,
    options?.include_cancelled === true,
  );
  return rows.map(mapTruckAssignmentRow);
}
