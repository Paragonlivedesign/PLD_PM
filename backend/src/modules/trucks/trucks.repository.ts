import type { Pool, PoolClient } from "pg";
import type { TruckResponse, TruckStatus, TruckType } from "@pld/shared";

export type DbTruckRow = {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  license_plate: string | null;
  vin: string | null;
  capacity_cubic_ft: string | null;
  capacity_lbs: string | null;
  home_base: string | null;
  status: string;
  daily_rate: string | null;
  mileage_rate: string | null;
  current_mileage: number | null;
  insurance_expiry: Date | string | null;
  inspection_expiry: Date | string | null;
  notes: string | null;
  metadata: unknown;
  custom_fields: unknown;
  retired_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function iso(d: Date): string {
  return d.toISOString();
}

function isoDateOnly(d: Date | string | null): string | null {
  if (d == null) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function dec(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

export function mapTruckRow(r: DbTruckRow): TruckResponse {
  const metadata =
    r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : {};
  const custom_fields =
    r.custom_fields && typeof r.custom_fields === "object" && !Array.isArray(r.custom_fields)
      ? (r.custom_fields as Record<string, unknown>)
      : {};
  return {
    id: r.id,
    name: r.name,
    type: r.type as TruckType,
    license_plate: r.license_plate,
    vin: r.vin,
    capacity_cubic_ft: dec(r.capacity_cubic_ft),
    capacity_lbs: dec(r.capacity_lbs),
    home_base: r.home_base,
    status: r.status as TruckStatus,
    daily_rate: dec(r.daily_rate),
    mileage_rate: dec(r.mileage_rate),
    current_mileage: r.current_mileage,
    insurance_expiry: isoDateOnly(r.insurance_expiry),
    inspection_expiry: isoDateOnly(r.inspection_expiry),
    notes: r.notes,
    metadata,
    custom_fields,
    created_at: iso(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
    updated_at: iso(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
    retired_at: r.retired_at
      ? iso(r.retired_at instanceof Date ? r.retired_at : new Date(r.retired_at))
      : null,
  };
}

export async function insertTruck(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    name: string;
    type: string;
    licensePlate: string | null;
    vin: string | null;
    capacityCubicFt: number | null;
    capacityLbs: number | null;
    homeBase: string | null;
    status: string;
    dailyRate: number | null;
    mileageRate: number | null;
    currentMileage: number | null;
    insuranceExpiry: string | null;
    inspectionExpiry: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    customFields?: Record<string, unknown>;
  },
): Promise<TruckResponse> {
  const cf = p.customFields && typeof p.customFields === "object" ? p.customFields : {};
  const r = await client.query<DbTruckRow>(
    `INSERT INTO trucks (
      id, tenant_id, name, type, license_plate, vin,
      capacity_cubic_ft, capacity_lbs, home_base, status,
      daily_rate, mileage_rate, current_mileage,
      insurance_expiry, inspection_expiry, notes, metadata, custom_fields
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15::date,$16,$17::jsonb,$18::jsonb
    ) RETURNING *`,
    [
      p.id,
      p.tenantId,
      p.name,
      p.type,
      p.licensePlate,
      p.vin,
      p.capacityCubicFt,
      p.capacityLbs,
      p.homeBase,
      p.status,
      p.dailyRate,
      p.mileageRate,
      p.currentMileage,
      p.insuranceExpiry,
      p.inspectionExpiry,
      p.notes,
      JSON.stringify(p.metadata),
      JSON.stringify(cf),
    ],
  );
  return mapTruckRow(r.rows[0]!);
}

export async function getTruckRowById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  includeDeleted = false,
): Promise<DbTruckRow | null> {
  const del = includeDeleted ? "" : " AND deleted_at IS NULL";
  const r = await client.query<DbTruckRow>(
    `SELECT * FROM trucks WHERE tenant_id = $1 AND id = $2${del}`,
    [tenantId, id],
  );
  return r.rows[0] ?? null;
}

export async function findDuplicateNameOrPlate(
  client: Pool | PoolClient,
  tenantId: string,
  name: string,
  licensePlate: string | null,
  excludeId?: string,
): Promise<"name" | "plate" | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id FROM trucks WHERE tenant_id = $1 AND deleted_at IS NULL
     AND lower(name) = lower($2) AND ($3::uuid IS NULL OR id <> $3)`,
    [tenantId, name, excludeId ?? null],
  );
  if (r.rows[0]) return "name";
  if (licensePlate?.trim()) {
    const r2 = await client.query<{ id: string }>(
      `SELECT id FROM trucks WHERE tenant_id = $1 AND deleted_at IS NULL
       AND license_plate IS NOT NULL AND lower(license_plate) = lower($2)
       AND ($3::uuid IS NULL OR id <> $3)`,
      [tenantId, licensePlate.trim(), excludeId ?? null],
    );
    if (r2.rows[0]) return "plate";
  }
  return null;
}

export type ListTrucksParams = {
  tenantId: string;
  type?: string[];
  status?: string[];
  homeBase?: string;
  minCapacityCubicFt?: number;
  minCapacityLbs?: number;
  search?: string;
  sortBy: "name" | "type" | "status" | "capacity_cubic_ft" | "created_at";
  sortOrder: "asc" | "desc";
  limit: number;
  /** Decoded offset (from opaque cursor). */
  offset: number;
};

function truckSortExpr(sortBy: ListTrucksParams["sortBy"]): string {
  switch (sortBy) {
    case "name":
      return "lower(t.name)";
    case "type":
      return "t.type";
    case "status":
      return "t.status";
    case "capacity_cubic_ft":
      return "t.capacity_cubic_ft";
    case "created_at":
      return "t.created_at";
    default:
      return "lower(t.name)";
  }
}

export type TruckListFilter = Omit<
  ListTrucksParams,
  "sortBy" | "sortOrder" | "limit" | "offset" | "cursorId"
>;

export async function countTrucks(
  client: Pool | PoolClient,
  p: TruckListFilter,
): Promise<number> {
  const { where, vals } = buildTruckWhere(p);
  const r = await client.query(`SELECT count(*)::int AS c FROM trucks t ${where}`, vals);
  return r.rows[0]?.c ?? 0;
}

function buildTruckWhere(p: TruckListFilter): { where: string; vals: unknown[] } {
  const vals: unknown[] = [p.tenantId];
  let i = 2;
  const parts = [`t.tenant_id = $1`, `t.deleted_at IS NULL`];
  if (p.type?.length) {
    parts.push(`t.type = ANY($${i}::text[])`);
    vals.push(p.type);
    i++;
  }
  if (p.status?.length) {
    parts.push(`t.status = ANY($${i}::text[])`);
    vals.push(p.status);
    i++;
  }
  if (p.homeBase?.trim()) {
    parts.push(`t.home_base ILIKE $${i}`);
    vals.push(`%${p.homeBase.trim()}%`);
    i++;
  }
  if (p.minCapacityCubicFt != null) {
    parts.push(`t.capacity_cubic_ft >= $${i}`);
    vals.push(p.minCapacityCubicFt);
    i++;
  }
  if (p.minCapacityLbs != null) {
    parts.push(`t.capacity_lbs >= $${i}`);
    vals.push(p.minCapacityLbs);
    i++;
  }
  if (p.search?.trim()) {
    parts.push(
      `(t.name ILIKE $${i} OR t.license_plate ILIKE $${i} OR t.home_base ILIKE $${i})`,
    );
    vals.push(`%${p.search.trim()}%`);
    i++;
  }
  return { where: `WHERE ${parts.join(" AND ")}`, vals };
}

export async function listTrucks(
  client: Pool | PoolClient,
  p: ListTrucksParams,
): Promise<DbTruckRow[]> {
  const { where, vals } = buildTruckWhere(p);
  const sort = truckSortExpr(p.sortBy);
  const dir = p.sortOrder === "desc" ? "DESC" : "ASC";
  const idDir = p.sortOrder === "desc" ? "DESC" : "ASC";
  const order =
    p.sortBy === "name"
      ? `ORDER BY lower(t.name) ${dir}, t.id ${idDir}`
      : `ORDER BY ${sort} ${dir}, t.id ${idDir}`;
  const take = p.limit + 1;
  const v = [...vals, take, p.offset];
  const li = vals.length + 1;
  const oi = vals.length + 2;
  const r = await client.query<DbTruckRow>(
    `SELECT t.* FROM trucks t
     ${where}
     ${order}
     LIMIT $${li} OFFSET $${oi}`,
    v,
  );
  return r.rows;
}

export function decodeListCursor(cursor: string | null | undefined): number {
  if (!cursor?.trim()) return 0;
  try {
    const j = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      o?: number;
    };
    return typeof j.o === "number" && j.o >= 0 ? j.o : 0;
  } catch {
    return 0;
  }
}

export function encodeListCursor(nextOffset: number): string {
  return Buffer.from(JSON.stringify({ o: nextOffset }), "utf8").toString(
    "base64url",
  );
}

export async function updateTruckPartial(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: Partial<{
    name: string;
    type: string;
    license_plate: string | null;
    vin: string | null;
    capacity_cubic_ft: number | null;
    capacity_lbs: number | null;
    home_base: string | null;
    status: string;
    daily_rate: number | null;
    mileage_rate: number | null;
    current_mileage: number | null;
    insurance_expiry: string | null;
    inspection_expiry: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    custom_fields?: Record<string, unknown>;
    retired_at: string | null;
  }>,
): Promise<TruckResponse | null> {
  const cur = await getTruckRowById(client, tenantId, id);
  if (!cur) return null;
  const name = patch.name ?? cur.name;
  const type = patch.type ?? cur.type;
  const license_plate =
    patch.license_plate !== undefined ? patch.license_plate : cur.license_plate;
  const vin = patch.vin !== undefined ? patch.vin : cur.vin;
  const capacity_cubic_ft =
    patch.capacity_cubic_ft !== undefined
      ? patch.capacity_cubic_ft
      : cur.capacity_cubic_ft
        ? Number(cur.capacity_cubic_ft)
        : null;
  const capacity_lbs =
    patch.capacity_lbs !== undefined
      ? patch.capacity_lbs
      : cur.capacity_lbs
        ? Number(cur.capacity_lbs)
        : null;
  const home_base = patch.home_base !== undefined ? patch.home_base : cur.home_base;
  const status = patch.status ?? cur.status;
  const daily_rate =
    patch.daily_rate !== undefined
      ? patch.daily_rate
      : cur.daily_rate
        ? Number(cur.daily_rate)
        : null;
  const mileage_rate =
    patch.mileage_rate !== undefined
      ? patch.mileage_rate
      : cur.mileage_rate
        ? Number(cur.mileage_rate)
        : null;
  const current_mileage =
    patch.current_mileage !== undefined
      ? patch.current_mileage
      : cur.current_mileage;
  const insurance_expiry =
    patch.insurance_expiry !== undefined
      ? patch.insurance_expiry
      : isoDateOnly(cur.insurance_expiry);
  const inspection_expiry =
    patch.inspection_expiry !== undefined
      ? patch.inspection_expiry
      : isoDateOnly(cur.inspection_expiry);
  const notes = patch.notes !== undefined ? patch.notes : cur.notes;
  const md =
    patch.metadata !== undefined
      ? patch.metadata
      : (cur.metadata as Record<string, unknown>);
  const custom_fields =
    patch.custom_fields !== undefined
      ? patch.custom_fields
      : cur.custom_fields && typeof cur.custom_fields === "object" && !Array.isArray(cur.custom_fields)
        ? (cur.custom_fields as Record<string, unknown>)
        : {};
  const retired_at =
    patch.retired_at !== undefined
      ? patch.retired_at
      : cur.retired_at
        ? iso(cur.retired_at instanceof Date ? cur.retired_at : new Date(cur.retired_at))
        : null;

  await client.query(
    `UPDATE trucks SET
      name = $3, type = $4, license_plate = $5, vin = $6,
      capacity_cubic_ft = $7, capacity_lbs = $8, home_base = $9, status = $10,
      daily_rate = $11, mileage_rate = $12, current_mileage = $13,
      insurance_expiry = $14::date, inspection_expiry = $15::date,
      notes = $16, metadata = $17::jsonb,
      custom_fields = $18::jsonb,
      retired_at = $19::timestamptz,
      updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [
      tenantId,
      id,
      name,
      type,
      license_plate,
      vin,
      capacity_cubic_ft,
      capacity_lbs,
      home_base,
      status,
      daily_rate,
      mileage_rate,
      current_mileage,
      insurance_expiry,
      inspection_expiry,
      notes,
      JSON.stringify(md),
      JSON.stringify(custom_fields),
      retired_at,
    ],
  );
  const row = await getTruckRowById(client, tenantId, id);
  return row ? mapTruckRow(row) : null;
}

export async function retireTruck(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; status: string; retired_at: string } | null> {
  const r = await client.query<{ retired_at: Date }>(
    `UPDATE trucks SET status = 'retired', retired_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING retired_at`,
    [tenantId, id],
  );
  if (!r.rows[0]) return null;
  return {
    id,
    status: "retired",
    retired_at: iso(r.rows[0].retired_at),
  };
}
