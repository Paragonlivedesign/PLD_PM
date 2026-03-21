import type { Pool, PoolClient } from "pg";
import type { CrewAssignmentResponse } from "./types.js";
import { eachDateInclusive, inclusiveDays } from "../../utils/dates.js";

export type DbCrewAssignmentRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  event_name: string;
  personnel_id: string;
  personnel_name: string;
  role: string;
  department_id: string | null;
  department_name: string | null;
  start_date: Date | string;
  end_date: Date | string;
  start_time: string | null;
  end_time: string | null;
  day_rate_override: string | null;
  per_diem_override: string | null;
  notes: string | null;
  status: string;
  has_conflicts: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function iso(d: Date): string {
  return d.toISOString();
}

function isoDate(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dec(n: number): string {
  return n.toFixed(4);
}

export function mapCrewAssignmentRow(
  r: DbCrewAssignmentRow,
  dayRate: number,
  perDiem: number,
): CrewAssignmentResponse {
  const start_date = isoDate(r.start_date);
  const end_date = isoDate(r.end_date);
  const total_days = inclusiveDays(start_date, end_date);
  const dr =
    r.day_rate_override != null && r.day_rate_override !== ""
      ? Number(r.day_rate_override)
      : dayRate;
  const pd =
    r.per_diem_override != null && r.per_diem_override !== ""
      ? Number(r.per_diem_override)
      : perDiem;
  const day_rate_override =
    r.day_rate_override != null && r.day_rate_override !== ""
      ? dec(Number(r.day_rate_override))
      : null;
  const per_diem_override =
    r.per_diem_override != null && r.per_diem_override !== ""
      ? dec(Number(r.per_diem_override))
      : null;
  return {
    id: r.id,
    event_id: r.event_id,
    event_name: r.event_name,
    personnel_id: r.personnel_id,
    personnel_name: r.personnel_name,
    role: r.role,
    department_id: r.department_id,
    department_name: r.department_name,
    start_date,
    end_date,
    start_time: r.start_time,
    end_time: r.end_time,
    day_rate: dec(dr),
    day_rate_override,
    per_diem: dec(pd),
    per_diem_override,
    total_days,
    total_cost: dec(dr * total_days),
    total_per_diem: dec(pd * total_days),
    notes: r.notes,
    status: r.status as CrewAssignmentResponse["status"],
    has_conflicts: r.has_conflicts,
    created_at: iso(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
    updated_at: iso(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
  };
}

export async function findOverlappingCrewAssignments(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
  startDate: string,
  endDate: string,
  excludeId?: string,
): Promise<DbCrewAssignmentRow[]> {
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT * FROM crew_assignments
     WHERE tenant_id = $1 AND personnel_id = $2 AND deleted_at IS NULL
       AND status <> 'cancelled'
       AND start_date <= $4::date AND end_date >= $3::date
       AND ($5::uuid IS NULL OR id <> $5)`,
    [tenantId, personnelId, startDate, endDate, excludeId ?? null],
  );
  return r.rows;
}

export async function listAllActiveCrewAssignmentsForPersonnel(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
): Promise<DbCrewAssignmentRow[]> {
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT * FROM crew_assignments
     WHERE tenant_id = $1 AND personnel_id = $2 AND deleted_at IS NULL AND status <> 'cancelled'
     ORDER BY start_date ASC, end_date ASC, id ASC`,
    [tenantId, personnelId],
  );
  return r.rows;
}

export async function selectDistinctEventIdsForPersonnelCrew(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
): Promise<string[]> {
  const r = await client.query<{ event_id: string }>(
    `SELECT DISTINCT event_id FROM crew_assignments
     WHERE tenant_id = $1 AND personnel_id = $2 AND deleted_at IS NULL AND status <> 'cancelled'`,
    [tenantId, personnelId],
  );
  return r.rows.map((x) => x.event_id);
}

export async function insertCrewAssignment(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    eventId: string;
    eventName: string;
    personnelId: string;
    personnelName: string;
    role: string;
    departmentId: string | null;
    departmentName: string | null;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    dayRateOverride: number | null;
    perDiemOverride: number | null;
    notes: string | null;
    status: string;
    hasConflicts: boolean;
  },
): Promise<DbCrewAssignmentRow> {
  await client.query(
    `INSERT INTO crew_assignments (
      id, tenant_id, event_id, event_name, personnel_id, personnel_name, role,
      department_id, department_name, start_date, end_date, start_time, end_time,
      day_rate_override, per_diem_override, notes, status, has_conflicts
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14,$15,$16,$17,$18)`,
    [
      p.id,
      p.tenantId,
      p.eventId,
      p.eventName,
      p.personnelId,
      p.personnelName,
      p.role,
      p.departmentId,
      p.departmentName,
      p.startDate,
      p.endDate,
      p.startTime,
      p.endTime,
      p.dayRateOverride,
      p.perDiemOverride,
      p.notes,
      p.status,
      p.hasConflicts,
    ],
  );
  const full = await getCrewAssignmentById(client, p.tenantId, p.id);
  if (!full) throw new Error("insert crew_assignment failed");
  return full;
}

export async function getCrewAssignmentById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<DbCrewAssignmentRow | null> {
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT * FROM crew_assignments
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  return r.rows[0] ?? null;
}

export type ListCrewAssignmentsParams = {
  tenantId: string;
  eventId?: string;
  personnelId?: string;
  departmentId?: string;
  status?: string[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  sortBy: "start_date" | "personnel_name" | "event_name" | "created_at";
  sortOrder: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function countCrewAssignments(
  client: Pool | PoolClient,
  p: Omit<ListCrewAssignmentsParams, "limit" | "offset" | "sortBy" | "sortOrder">,
): Promise<number> {
  const { where, vals } = buildCaWhere(p);
  const r = await client.query(`SELECT count(*)::int AS c FROM crew_assignments ca ${where}`, vals);
  return r.rows[0]?.c ?? 0;
}

function buildCaWhere(
  p: Omit<ListCrewAssignmentsParams, "limit" | "offset" | "sortBy" | "sortOrder">,
): { where: string; vals: unknown[] } {
  const vals: unknown[] = [p.tenantId];
  let i = 2;
  const parts = [`ca.tenant_id = $1`, `ca.deleted_at IS NULL`];
  if (p.eventId) {
    parts.push(`ca.event_id = $${i}`);
    vals.push(p.eventId);
    i++;
  }
  if (p.personnelId) {
    parts.push(`ca.personnel_id = $${i}`);
    vals.push(p.personnelId);
    i++;
  }
  if (p.departmentId) {
    parts.push(`ca.department_id = $${i}`);
    vals.push(p.departmentId);
    i++;
  }
  if (p.status?.length) {
    parts.push(`ca.status = ANY($${i}::text[])`);
    vals.push(p.status);
    i++;
  }
  if (p.dateRangeStart) {
    parts.push(`ca.end_date >= $${i}::date`);
    vals.push(p.dateRangeStart);
    i++;
  }
  if (p.dateRangeEnd) {
    parts.push(`ca.start_date <= $${i}::date`);
    vals.push(p.dateRangeEnd);
    i++;
  }
  return { where: `WHERE ${parts.join(" AND ")}`, vals };
}

function orderClause(sortBy: ListCrewAssignmentsParams["sortBy"], sortOrder: string): string {
  const dir = sortOrder === "desc" ? "DESC" : "ASC";
  const col =
    sortBy === "personnel_name"
      ? "ca.personnel_name"
      : sortBy === "event_name"
        ? "ca.event_name"
        : sortBy === "created_at"
          ? "ca.created_at"
          : "ca.start_date";
  return `${col} ${dir}, ca.id ${dir}`;
}

export async function listCrewAssignments(
  client: Pool | PoolClient,
  p: ListCrewAssignmentsParams,
): Promise<DbCrewAssignmentRow[]> {
  const { where, vals } = buildCaWhere(p);
  const ord = orderClause(p.sortBy, p.sortOrder);
  const v = [...vals, p.offset, p.limit + 1];
  const offIdx = vals.length + 1;
  const limIdx = vals.length + 2;
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT ca.* FROM crew_assignments ca
     ${where}
     ORDER BY ${ord}
     OFFSET $${offIdx} LIMIT $${limIdx}`,
    v,
  );
  return r.rows;
}

export async function updateCrewAssignment(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    role?: string;
    departmentId?: string | null;
    departmentName?: string | null;
    startDate?: string;
    endDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    dayRateOverride?: number | null;
    perDiemOverride?: number | null;
    notes?: string | null;
    status?: string;
    hasConflicts?: boolean;
    eventName?: string;
    personnelName?: string;
  },
): Promise<DbCrewAssignmentRow | null> {
  const cur = await client.query<DbCrewAssignmentRow>(
    `SELECT * FROM crew_assignments WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  const row = cur.rows[0];
  if (!row) return null;
  const role = patch.role ?? row.role;
  const departmentId =
    patch.departmentId !== undefined ? patch.departmentId : row.department_id;
  const departmentName =
    patch.departmentName !== undefined ? patch.departmentName : row.department_name;
  const startDate = patch.startDate ?? isoDate(row.start_date);
  const endDate = patch.endDate ?? isoDate(row.end_date);
  const startTime = patch.startTime !== undefined ? patch.startTime : row.start_time;
  const endTime = patch.endTime !== undefined ? patch.endTime : row.end_time;
  const dayRateOverride =
    patch.dayRateOverride !== undefined ? patch.dayRateOverride : row.day_rate_override != null
      ? Number(row.day_rate_override)
      : null;
  const perDiemOverride =
    patch.perDiemOverride !== undefined ? patch.perDiemOverride : row.per_diem_override != null
      ? Number(row.per_diem_override)
      : null;
  const notes = patch.notes !== undefined ? patch.notes : row.notes;
  const status = patch.status ?? row.status;
  const hasConflicts = patch.hasConflicts !== undefined ? patch.hasConflicts : row.has_conflicts;
  const eventName = patch.eventName ?? row.event_name;
  const personnelName = patch.personnelName ?? row.personnel_name;
  await client.query(
    `UPDATE crew_assignments SET
      role = $3,
      department_id = $4,
      department_name = $5,
      start_date = $6::date,
      end_date = $7::date,
      start_time = $8,
      end_time = $9,
      day_rate_override = $10,
      per_diem_override = $11,
      notes = $12,
      status = $13,
      has_conflicts = $14,
      event_name = $15,
      personnel_name = $16,
      updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2`,
    [
      tenantId,
      id,
      role,
      departmentId,
      departmentName,
      startDate,
      endDate,
      startTime,
      endTime,
      dayRateOverride,
      perDiemOverride,
      notes,
      status,
      hasConflicts,
      eventName,
      personnelName,
    ],
  );
  return getCrewAssignmentById(client, tenantId, id);
}

export async function softDeleteCrewAssignment(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const r = await client.query<{ deleted_at: Date }>(
    `UPDATE crew_assignments SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING deleted_at`,
    [tenantId, id],
  );
  if (!r.rows[0]) return null;
  return { id, deleted_at: iso(r.rows[0].deleted_at) };
}

export async function listCrewAssignmentsByEventId(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
  statusFilter?: string[],
  includeCancelled = false,
): Promise<DbCrewAssignmentRow[]> {
  const vals: unknown[] = [tenantId, eventId];
  let extra = "";
  if (statusFilter?.length) {
    extra = ` AND ca.status = ANY($3::text[])`;
    vals.push(statusFilter);
  } else if (!includeCancelled) {
    extra = ` AND ca.status <> 'cancelled'`;
  }
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT ca.* FROM crew_assignments ca
     WHERE ca.tenant_id = $1 AND ca.event_id = $2 AND ca.deleted_at IS NULL${extra}
     ORDER BY ca.start_date ASC`,
    vals,
  );
  return r.rows;
}

export async function listCrewAssignmentsByPersonnelInRange(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
  startDate: string,
  endDate: string,
  statusFilter?: string[],
  includeCancelled = false,
): Promise<DbCrewAssignmentRow[]> {
  const vals: unknown[] = [tenantId, personnelId, startDate, endDate];
  let extra = "";
  if (statusFilter?.length) {
    extra = ` AND ca.status = ANY($5::text[])`;
    vals.push(statusFilter);
  } else if (!includeCancelled) {
    extra = ` AND ca.status <> 'cancelled'`;
  }
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT ca.* FROM crew_assignments ca
     WHERE ca.tenant_id = $1 AND ca.personnel_id = $2 AND ca.deleted_at IS NULL
       AND ca.start_date <= $4::date AND ca.end_date >= $3::date${extra}
     ORDER BY ca.start_date ASC`,
    vals,
  );
  return r.rows;
}

export async function listCrewAssignmentsOverlappingRange(
  client: Pool | PoolClient,
  tenantId: string,
  rangeStart: string,
  rangeEnd: string,
  filters?: {
    personnelId?: string;
    eventId?: string;
    departmentId?: string;
    status?: string[];
    includeCancelled?: boolean;
  },
): Promise<DbCrewAssignmentRow[]> {
  const vals: unknown[] = [tenantId, rangeStart, rangeEnd];
  let i = 4;
  const parts = [
    `ca.tenant_id = $1`,
    `ca.deleted_at IS NULL`,
    `ca.end_date >= $2::date`,
    `ca.start_date <= $3::date`,
  ];
  if (!filters?.includeCancelled) {
    parts.push(`ca.status <> 'cancelled'`);
  }
  if (filters?.personnelId) {
    parts.push(`ca.personnel_id = $${i}`);
    vals.push(filters.personnelId);
    i++;
  }
  if (filters?.eventId) {
    parts.push(`ca.event_id = $${i}`);
    vals.push(filters.eventId);
    i++;
  }
  if (filters?.departmentId) {
    parts.push(`ca.department_id = $${i}`);
    vals.push(filters.departmentId);
    i++;
  }
  if (filters?.status?.length) {
    parts.push(`ca.status = ANY($${i}::text[])`);
    vals.push(filters.status);
    i++;
  }
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT ca.* FROM crew_assignments ca WHERE ${parts.join(" AND ")} ORDER BY ca.start_date ASC`,
    vals,
  );
  return r.rows;
}

export async function countFutureCrewAssignmentsForPersonnel(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
  fromDate: string,
): Promise<number> {
  const r = await client.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM crew_assignments
     WHERE tenant_id = $1 AND personnel_id = $2 AND deleted_at IS NULL
       AND status IN ('tentative', 'confirmed')
       AND end_date >= $3::date`,
    [tenantId, personnelId, fromDate],
  );
  return r.rows[0]?.c ?? 0;
}

export async function expandCrewAssignmentsToDays(
  client: Pool | PoolClient,
  tenantId: string,
  personnelId: string,
  startDate: string,
  endDate: string,
): Promise<
  { assignment_id: string; event_id: string; event_name: string; role: string; date: string }[]
> {
  const rows = await listCrewAssignmentsByPersonnelInRange(
    client,
    tenantId,
    personnelId,
    startDate,
    endDate,
  );
  const out: { assignment_id: string; event_id: string; event_name: string; role: string; date: string }[] =
    [];
  for (const row of rows) {
    const s = isoDate(row.start_date);
    const e = isoDate(row.end_date);
    for (const d of eachDateInclusive(s, e)) {
      if (d >= startDate && d <= endDate) {
        out.push({
          assignment_id: row.id,
          event_id: row.event_id,
          event_name: row.event_name,
          role: row.role,
          date: d,
        });
      }
    }
  }
  return out;
}

export type CrewAssignmentDaySlice = {
  assignment_id: string;
  event_id: string;
  event_name: string;
  role: string;
  date: string;
};

export async function listCrewAssignmentsByPersonnelIdsInRange(
  client: Pool | PoolClient,
  tenantId: string,
  personnelIds: string[],
  startDate: string,
  endDate: string,
): Promise<DbCrewAssignmentRow[]> {
  if (personnelIds.length === 0) return [];
  const r = await client.query<DbCrewAssignmentRow>(
    `SELECT ca.* FROM crew_assignments ca
     WHERE ca.tenant_id = $1 AND ca.deleted_at IS NULL AND ca.status <> 'cancelled'
       AND ca.personnel_id = ANY($2::uuid[])
       AND ca.end_date >= $3::date AND ca.start_date <= $4::date
     ORDER BY ca.personnel_id, ca.start_date ASC`,
    [tenantId, personnelIds, startDate, endDate],
  );
  return r.rows;
}

/** Expand many assignments into per-personnel_id day slices (within [startDate, endDate]). */
export function expandCrewAssignmentsToDaysByPersonnel(
  rows: DbCrewAssignmentRow[],
  startDate: string,
  endDate: string,
): Map<string, CrewAssignmentDaySlice[]> {
  const map = new Map<string, CrewAssignmentDaySlice[]>();
  for (const row of rows) {
    const pid = row.personnel_id;
    const s = isoDate(row.start_date);
    const e = isoDate(row.end_date);
    for (const d of eachDateInclusive(s, e)) {
      if (d >= startDate && d <= endDate) {
        const slice: CrewAssignmentDaySlice = {
          assignment_id: row.id,
          event_id: row.event_id,
          event_name: row.event_name,
          role: row.role,
          date: d,
        };
        const list = map.get(pid) ?? [];
        list.push(slice);
        map.set(pid, list);
      }
    }
  }
  return map;
}
