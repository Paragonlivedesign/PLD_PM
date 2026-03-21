import type { Pool, PoolClient } from "pg";
import type { ClientResponse } from "@pld/shared";

type Row = {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  notes: string | null;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function map(r: Row): ClientResponse {
  const metadata =
    r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : {};
  return {
    id: r.id,
    name: r.name,
    contact_name: r.contact_name,
    contact_email: r.contact_email,
    phone: r.phone,
    notes: r.notes,
    metadata,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
  };
}

export async function getClientById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<ClientResponse | null> {
  const r = await client.query<Row>(
    `SELECT * FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function insertClient(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    name: string;
    contactName: string | null;
    contactEmail: string | null;
    phone: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<ClientResponse> {
  const r = await client.query<Row>(
    `INSERT INTO clients (id, tenant_id, name, contact_name, contact_email, phone, notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
    [
      p.id,
      p.tenantId,
      p.name,
      p.contactName,
      p.contactEmail,
      p.phone,
      p.notes,
      JSON.stringify(p.metadata),
    ],
  );
  return map(r.rows[0]);
}

export async function updateClientRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: Record<string, unknown>,
  expectedUpdatedAt?: string,
): Promise<ClientResponse | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${n}`);
    vals.push(val);
    n++;
  };
  if (patch.name !== undefined) add("name", patch.name);
  if (patch.contact_name !== undefined) add("contact_name", patch.contact_name);
  if (patch.contact_email !== undefined) add("contact_email", patch.contact_email);
  if (patch.phone !== undefined) add("phone", patch.phone);
  if (patch.notes !== undefined) add("notes", patch.notes);
  if (patch.metadata !== undefined) {
    sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${n}::jsonb`);
    vals.push(JSON.stringify(patch.metadata));
    n++;
  }
  if (sets.length === 0) {
    if (expectedUpdatedAt) {
      const chk = await client.query<Row>(
        `SELECT * FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL AND updated_at = $3::timestamptz`,
        [tenantId, id, expectedUpdatedAt],
      );
      return chk.rows[0] ? map(chk.rows[0]) : null;
    }
    return getClientById(client, tenantId, id);
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
    `UPDATE clients SET ${sets.join(", ")} WHERE ${where} RETURNING *`,
    vals,
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function countClientsForList(
  client: Pool | PoolClient,
  tenantId: string,
  search?: string,
): Promise<number> {
  const vals: unknown[] = [tenantId];
  let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
  if (search?.trim()) {
    w += ` AND (name ILIKE $2 OR contact_name ILIKE $2)`;
    vals.push(`%${search.trim()}%`);
  }
  const r = await client.query(`SELECT count(*)::int AS c FROM clients ${w}`, vals);
  return r.rows[0]?.c ?? 0;
}

export async function listClients(
  client: Pool | PoolClient,
  tenantId: string,
  search: string | undefined,
  limit: number,
  cursorUpdatedAt: string | null,
  cursorId: string | null,
): Promise<ClientResponse[]> {
  const vals: unknown[] = [tenantId];
  let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
  let i = 2;
  if (search?.trim()) {
    w += ` AND (name ILIKE $${i} OR contact_name ILIKE $${i})`;
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
    `SELECT * FROM clients ${w} ORDER BY updated_at DESC, id DESC LIMIT $${vals.length}`,
    vals,
  );
  return r.rows.map(map);
}

export async function softDeleteClient(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const r = await client.query<{ id: string; deleted_at: Date }>(
    `UPDATE clients SET deleted_at = NOW(), updated_at = NOW()
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

export async function countEventsForClient(
  client: Pool | PoolClient,
  tenantId: string,
  clientId: string,
): Promise<number> {
  const r = await client.query(
    `SELECT count(*)::int AS c FROM events e
     WHERE e.tenant_id = $1 AND e.client_id = $2 AND e.deleted_at IS NULL`,
    [tenantId, clientId],
  );
  return r.rows[0]?.c ?? 0;
}
