import type { Pool, PoolClient } from "pg";
import type { VenueResponse } from "@pld/shared";

type Row = {
  id: string;
  tenant_id: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  notes: string | null;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function map(r: Row): VenueResponse {
  const metadata =
    r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : {};
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    notes: r.notes,
    metadata,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
  };
}

export async function getVenueById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<VenueResponse | null> {
  const r = await client.query<Row>(
    `SELECT * FROM venues WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function insertVenue(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    name: string;
    city: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<VenueResponse> {
  const r = await client.query<Row>(
    `INSERT INTO venues (id, tenant_id, name, city, address, latitude, longitude, timezone, notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
    [
      p.id,
      p.tenantId,
      p.name,
      p.city,
      p.address,
      p.latitude,
      p.longitude,
      p.timezone,
      p.notes,
      JSON.stringify(p.metadata),
    ],
  );
  return map(r.rows[0]);
}

export async function updateVenueRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<VenueResponse | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  const fields = [
    "name",
    "city",
    "address",
    "latitude",
    "longitude",
    "timezone",
    "notes",
  ] as const;
  for (const f of fields) {
    if (patch[f] !== undefined) {
      sets.push(`${f} = $${n++}`);
      vals.push(patch[f]);
    }
  }
  if (patch.metadata !== undefined) {
    sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${n}::jsonb`);
    vals.push(JSON.stringify(patch.metadata));
    n++;
  }
  if (sets.length === 0) {
    if (expectedUpdatedAt) {
      const chk = await client.query<Row>(
        `SELECT * FROM venues WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL AND updated_at = $3::timestamptz`,
        [tenantId, id, expectedUpdatedAt],
      );
      return chk.rows[0] ? map(chk.rows[0]) : null;
    }
    return getVenueById(client, tenantId, id);
  }
  sets.push(`updated_at = NOW()`);
  vals.push(tenantId, id);
  let where = `tenant_id = $${n} AND id = $${n + 1} AND deleted_at IS NULL`;
  n += 2;
  if (expectedUpdatedAt) {
    where += ` AND updated_at = $${n}::timestamptz`;
    vals.push(expectedUpdatedAt);
  }
  const r = await client.query<Row>(
    `UPDATE venues SET ${sets.join(", ")} WHERE ${where} RETURNING *`,
    vals,
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function listVenues(
  client: Pool | PoolClient,
  tenantId: string,
  search: string | undefined,
  limit: number,
  cursorUpdatedAt: string | null,
  cursorId: string | null,
): Promise<VenueResponse[]> {
  const vals: unknown[] = [tenantId];
  let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
  let i = 2;
  if (search?.trim()) {
    w += ` AND (name ILIKE $${i} OR city ILIKE $${i})`;
    vals.push(`%${search.trim()}%`);
    i++;
  }
  if (cursorUpdatedAt && cursorId) {
    w += ` AND (updated_at < $${i}::timestamptz OR (updated_at = $${i}::timestamptz AND id < $${i + 1}::uuid))`;
    vals.push(cursorUpdatedAt, cursorId);
    i += 2;
  }
  vals.push(limit);
  const r = await client.query<Row>(
    `SELECT * FROM venues ${w} ORDER BY updated_at DESC, id DESC LIMIT $${vals.length}`,
    vals,
  );
  return r.rows.map(map);
}

export async function countVenues(
  client: Pool | PoolClient,
  tenantId: string,
  search?: string,
): Promise<number> {
  const vals: unknown[] = [tenantId];
  let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
  if (search?.trim()) {
    w += ` AND (name ILIKE $2 OR city ILIKE $2)`;
    vals.push(`%${search.trim()}%`);
  }
  const r = await client.query(`SELECT count(*)::int AS c FROM venues ${w}`, vals);
  return r.rows[0]?.c ?? 0;
}

export async function softDeleteVenue(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const r = await client.query<{ id: string; deleted_at: Date }>(
    `UPDATE venues SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`,
    [tenantId, id],
  );
  if (!r.rows[0]) return null;
  return {
    id: r.rows[0].id,
    deleted_at: r.rows[0].deleted_at.toISOString(),
  };
}

export async function countEventsForVenue(
  client: Pool | PoolClient,
  tenantId: string,
  venueId: string,
): Promise<number> {
  const r = await client.query(
    `SELECT count(*)::int AS c FROM events e
     WHERE e.tenant_id = $1 AND e.venue_id = $2 AND e.deleted_at IS NULL`,
    [tenantId, venueId],
  );
  return r.rows[0]?.c ?? 0;
}
