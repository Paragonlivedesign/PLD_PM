import type { Pool, PoolClient } from "pg";
import type { DbTravelRow, TravelAccommodationJson, TravelRecordResponse } from "./types.js";
import { mapRowToResponse } from "./map.js";

function iso(d: Date): string {
  return d.toISOString();
}

export type ListTravelParams = {
  tenantId: string;
  eventId?: string;
  personnelId?: string;
  travelTypes?: string[];
  directions?: string[];
  statuses?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  hasAccommodation?: boolean;
  search?: string;
  sortBy: "departure_datetime" | "personnel_name" | "created_at";
  sortOrder: "asc" | "desc";
  limit: number;
  cursorVal: string | null;
  cursorId: string | null;
};

export function encodeTravelCursor(
  row: TravelRecordResponse,
  sortBy: ListTravelParams["sortBy"],
): string {
  let v: string;
  switch (sortBy) {
    case "personnel_name":
      v = row.personnel_name.toLowerCase();
      break;
    case "created_at":
      v = row.created_at;
      break;
    default:
      v = row.departure_datetime;
  }
  return Buffer.from(JSON.stringify({ v, id: row.id, sb: sortBy }), "utf8").toString("base64url");
}

export function decodeTravelCursor(
  raw: string | undefined,
): { v: string; id: string; sortBy: ListTravelParams["sortBy"] } | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      v?: string;
      id?: string;
      sb?: string;
    };
    const keys = ["departure_datetime", "personnel_name", "created_at"];
    if (j.v != null && j.id != null && j.sb != null && keys.includes(j.sb)) {
      return { v: j.v, id: j.id, sortBy: j.sb as ListTravelParams["sortBy"] };
    }
  } catch {
    return null;
  }
  return null;
}

function baseSelect(): string {
  return `SELECT tr.*,
    e.name AS event_name,
    p.first_name AS personnel_first,
    p.last_name AS personnel_last,
    ps.first_name AS share_first,
    ps.last_name AS share_last
    FROM travel_records tr
    INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
    INNER JOIN personnel p ON p.id = tr.personnel_id AND p.tenant_id = tr.tenant_id AND p.deleted_at IS NULL
    LEFT JOIN personnel ps ON ps.id = (NULLIF(tr.accommodation->>'sharing_with', ''))::uuid
      AND ps.tenant_id = tr.tenant_id AND ps.deleted_at IS NULL`;
}

export async function insertTravelRecord(
  client: Pool | PoolClient,
  row: {
    id: string;
    tenantId: string;
    eventId: string;
    personnelId: string;
    travelType: string;
    direction: string;
    departureLocation: string;
    arrivalLocation: string;
    departureDatetime: string;
    arrivalDatetime: string;
    carrier: string | null;
    bookingReference: string | null;
    seatPreference: string | null;
    cost: string | null;
    currency: string;
    status: string;
    notes: string | null;
    accommodation: TravelAccommodationJson | null;
    metadata: Record<string, unknown>;
  },
): Promise<TravelRecordResponse | null> {
  const r = await client.query<DbTravelRow>(
    `${baseSelect()} WHERE FALSE`,
    [],
  );
  void r;
  const ins = await client.query<DbTravelRow>(
    `INSERT INTO travel_records (
      id, tenant_id, event_id, personnel_id, travel_type, direction,
      departure_location, arrival_location, departure_datetime, arrival_datetime,
      carrier, booking_reference, seat_preference, cost, currency, status, notes,
      accommodation, metadata
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,
      $11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb
    )
    RETURNING id`,
    [
      row.id,
      row.tenantId,
      row.eventId,
      row.personnelId,
      row.travelType,
      row.direction,
      row.departureLocation,
      row.arrivalLocation,
      row.departureDatetime,
      row.arrivalDatetime,
      row.carrier,
      row.bookingReference,
      row.seatPreference,
      row.cost,
      row.currency,
      row.status,
      row.notes,
      row.accommodation ? JSON.stringify(row.accommodation) : null,
      JSON.stringify(row.metadata),
    ],
  );
  const newId = ins.rows[0]?.id;
  if (!newId) return null;
  return getTravelById(client, row.tenantId, newId);
}

export async function getTravelById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<TravelRecordResponse | null> {
  const r = await client.query<DbTravelRow>(
    `${baseSelect()}
     WHERE tr.tenant_id = $1 AND tr.id = $2 AND tr.deleted_at IS NULL`,
    [tenantId, id],
  );
  const row = r.rows[0];
  return row ? mapRowToResponse(row) : null;
}

export async function updateTravelRecordRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    travel_type?: string;
    direction?: string;
    departure_location?: string;
    arrival_location?: string;
    departure_datetime?: string;
    arrival_datetime?: string;
    carrier?: string | null;
    booking_reference?: string | null;
    seat_preference?: string | null;
    cost?: string | null;
    currency?: string;
    status?: string;
    notes?: string | null;
    accommodation?: TravelAccommodationJson | null;
    metadata?: Record<string, unknown>;
  },
): Promise<TravelRecordResponse | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const push = (frag: string, val?: unknown) => {
    sets.push(frag.replace(/\$N/g, `$${i}`));
    if (val !== undefined) {
      vals.push(val);
      i++;
    }
  };
  if (patch.travel_type != null) push("travel_type = $N", patch.travel_type);
  if (patch.direction != null) push("direction = $N", patch.direction);
  if (patch.departure_location != null) push("departure_location = $N", patch.departure_location);
  if (patch.arrival_location != null) push("arrival_location = $N", patch.arrival_location);
  if (patch.departure_datetime != null) push("departure_datetime = $N::timestamptz", patch.departure_datetime);
  if (patch.arrival_datetime != null) push("arrival_datetime = $N::timestamptz", patch.arrival_datetime);
  if (patch.carrier !== undefined) push("carrier = $N", patch.carrier);
  if (patch.booking_reference !== undefined) push("booking_reference = $N", patch.booking_reference);
  if (patch.seat_preference !== undefined) push("seat_preference = $N", patch.seat_preference);
  if (patch.cost !== undefined) push("cost = $N", patch.cost);
  if (patch.currency != null) push("currency = $N", patch.currency);
  if (patch.status != null) push("status = $N", patch.status);
  if (patch.notes !== undefined) push("notes = $N", patch.notes);
  if (patch.accommodation !== undefined) {
    push("accommodation = $N::jsonb", patch.accommodation ? JSON.stringify(patch.accommodation) : null);
  }
  if (patch.metadata != null) {
    push("metadata = COALESCE(metadata, '{}'::jsonb) || $N::jsonb", JSON.stringify(patch.metadata));
  }
  if (sets.length === 0) return getTravelById(client, tenantId, id);
  sets.push("updated_at = NOW()");
  vals.push(tenantId, id);
  const tid = i;
  const iid = i + 1;
  await client.query(
    `UPDATE travel_records SET ${sets.join(", ")}
     WHERE tenant_id = $${tid} AND id = $${iid}::uuid AND deleted_at IS NULL`,
    vals,
  );
  return getTravelById(client, tenantId, id);
}

export async function softDeleteTravel(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const r = await client.query<{ deleted_at: Date }>(
    `UPDATE travel_records SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING deleted_at`,
    [tenantId, id],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { id, deleted_at: iso(row.deleted_at instanceof Date ? row.deleted_at : new Date(row.deleted_at)) };
}

export async function countTravelRecords(
  client: Pool | PoolClient,
  p: Omit<ListTravelParams, "sortBy" | "sortOrder" | "limit" | "cursorVal" | "cursorId">,
): Promise<number> {
  const { where, vals } = buildWhere(p);
  const r = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM travel_records tr
     INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
     INNER JOIN personnel p ON p.id = tr.personnel_id AND p.tenant_id = tr.tenant_id AND p.deleted_at IS NULL
     WHERE ${where}`,
    vals,
  );
  return Number.parseInt(r.rows[0]?.n ?? "0", 10);
}

function buildWhere(
  p: Omit<ListTravelParams, "sortBy" | "sortOrder" | "limit" | "cursorVal" | "cursorId">,
): { where: string; vals: unknown[] } {
  const parts: string[] = ["tr.tenant_id = $1", "tr.deleted_at IS NULL"];
  const vals: unknown[] = [p.tenantId];
  let i = 2;
  if (p.eventId) {
    parts.push(`tr.event_id = $${i}`);
    vals.push(p.eventId);
    i++;
  }
  if (p.personnelId) {
    parts.push(`tr.personnel_id = $${i}`);
    vals.push(p.personnelId);
    i++;
  }
  if (p.travelTypes?.length) {
    parts.push(`tr.travel_type = ANY($${i}::text[])`);
    vals.push(p.travelTypes);
    i++;
  }
  if (p.directions?.length) {
    parts.push(`tr.direction = ANY($${i}::text[])`);
    vals.push(p.directions);
    i++;
  }
  if (p.statuses?.length) {
    parts.push(`tr.status = ANY($${i}::text[])`);
    vals.push(p.statuses);
    i++;
  }
  if (p.dateRangeStart) {
    parts.push(`tr.departure_datetime::date >= $${i}::date`);
    vals.push(p.dateRangeStart);
    i++;
  }
  if (p.dateRangeEnd) {
    parts.push(`tr.departure_datetime::date <= $${i}::date`);
    vals.push(p.dateRangeEnd);
    i++;
  }
  if (p.hasAccommodation === true) {
    parts.push(`tr.accommodation IS NOT NULL AND tr.accommodation::text <> 'null'`);
  }
  if (p.hasAccommodation === false) {
    parts.push(`tr.accommodation IS NULL OR tr.accommodation::text = 'null'`);
  }
  if (p.search?.trim()) {
    const q = `%${p.search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    parts.push(
      `(tr.departure_location ILIKE $${i} ESCAPE '\\' OR tr.arrival_location ILIKE $${i} ESCAPE '\\' OR tr.carrier ILIKE $${i} ESCAPE '\\' OR tr.booking_reference ILIKE $${i} ESCAPE '\\')`,
    );
    vals.push(q);
    i++;
  }
  return { where: parts.join(" AND "), vals };
}

function orderClause(sortBy: ListTravelParams["sortBy"], sortOrder: "asc" | "desc"): string {
  const dir = sortOrder === "desc" ? "DESC" : "ASC";
  const nulls = sortOrder === "desc" ? "NULLS LAST" : "NULLS FIRST";
  if (sortBy === "personnel_name") {
    return `ORDER BY LOWER(p.first_name || ' ' || p.last_name) ${dir} ${nulls}, tr.id ${dir}`;
  }
  if (sortBy === "created_at") {
    return `ORDER BY tr.created_at ${dir} ${nulls}, tr.id ${dir}`;
  }
  return `ORDER BY tr.departure_datetime ${dir} ${nulls}, tr.id ${dir}`;
}

function cursorClause(
  sortBy: ListTravelParams["sortBy"],
  sortOrder: "asc" | "desc",
  cursorVal: string,
  cursorId: string,
): { sql: string; vals: unknown[] } {
  const cmp = sortOrder === "asc" ? ">" : "<";
  if (sortBy === "personnel_name") {
    return {
      sql: `(LOWER(p.first_name || ' ' || p.last_name), tr.id) ${cmp} (LOWER($1), $2::uuid)`,
      vals: [cursorVal, cursorId],
    };
  }
  if (sortBy === "created_at") {
    return {
      sql: `(tr.created_at, tr.id) ${cmp} ($1::timestamptz, $2::uuid)`,
      vals: [cursorVal, cursorId],
    };
  }
  return {
    sql: `(tr.departure_datetime, tr.id) ${cmp} ($1::timestamptz, $2::uuid)`,
    vals: [cursorVal, cursorId],
  };
}

export async function listTravelRecords(
  client: Pool | PoolClient,
  p: ListTravelParams,
): Promise<TravelRecordResponse[]> {
  const { where, vals } = buildWhere(p);
  const ord = orderClause(p.sortBy, p.sortOrder);
  let cursorSql = "";
  const allVals = [...vals];
  if (p.cursorVal != null && p.cursorId != null) {
    const c = cursorClause(p.sortBy, p.sortOrder, p.cursorVal, p.cursorId);
    cursorSql = ` AND (${c.sql})`;
    allVals.push(...c.vals);
  }
  allVals.push(p.limit + 1);
  const r = await client.query<DbTravelRow>(
    `${baseSelect()}
     WHERE ${where}${cursorSql}
     ${ord}
     LIMIT $${allVals.length}`,
    allVals,
  );
  return r.rows.map((row) => mapRowToResponse(row));
}

export async function listTravelForEvent(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
  options?: {
    direction?: string;
    statuses?: string[];
    sortBy?: "departure_datetime" | "personnel_name";
    sortOrder?: "asc" | "desc";
  },
): Promise<TravelRecordResponse[]> {
  const sortBy = options?.sortBy ?? "departure_datetime";
  const sortOrder = options?.sortOrder ?? "asc";
  const p: ListTravelParams = {
    tenantId,
    eventId,
    directions: options?.direction ? [options.direction] : undefined,
    statuses: options?.statuses,
    sortBy: sortBy === "personnel_name" ? "personnel_name" : "departure_datetime",
    sortOrder,
    limit: 10_000,
    cursorVal: null,
    cursorId: null,
  };
  return listTravelRecords(client, p);
}

export async function listTravelForPersonnel(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
  options?: {
    dateRangeStart?: string;
    dateRangeEnd?: string;
    eventId?: string;
    statuses?: string[];
    limit: number;
    cursorVal: string | null;
    cursorId: string | null;
    sortOrder?: "asc" | "desc";
  },
): Promise<TravelRecordResponse[]> {
  const sortOrder = options?.sortOrder ?? "desc";
  const p: ListTravelParams = {
    tenantId,
    personnelId,
    eventId: options?.eventId,
    dateRangeStart: options?.dateRangeStart,
    dateRangeEnd: options?.dateRangeEnd,
    statuses: options?.statuses,
    sortBy: "departure_datetime",
    sortOrder,
    limit: options?.limit ?? 25,
    cursorVal: options?.cursorVal ?? null,
    cursorId: options?.cursorId ?? null,
  };
  return listTravelRecords(client, p);
}
