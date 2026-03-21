import type { Pool, PoolClient } from "pg";
import type { VendorResponse } from "@pld/shared";

type Row = {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  notes: string | null;
  metadata: unknown;
  linked_client_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function map(r: Row): VendorResponse {
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
    linked_client_id: r.linked_client_id,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
  };
}

export async function getVendorById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<VendorResponse | null> {
  const r = await client.query<Row>(
    `SELECT * FROM vendors WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, id],
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function listVendors(
  client: Pool | PoolClient,
  tenantId: string,
  limit: number,
  search?: string,
): Promise<VendorResponse[]> {
  const vals: unknown[] = [tenantId];
  let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
  if (search?.trim()) {
    w += ` AND (name ILIKE $2 OR COALESCE(contact_email,'') ILIKE $2 OR COALESCE(contact_name,'') ILIKE $2)`;
    vals.push(`%${search.trim()}%`);
    vals.push(limit);
    const r = await client.query<Row>(
      `SELECT * FROM vendors ${w} ORDER BY lower(name) ASC LIMIT $3`,
      vals,
    );
    return r.rows.map(map);
  }
  vals.push(limit);
  const r = await client.query<Row>(
    `SELECT * FROM vendors ${w} ORDER BY lower(name) ASC LIMIT $2`,
    vals,
  );
  return r.rows.map(map);
}

export async function insertVendor(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    phone: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    linked_client_id: string | null;
  },
): Promise<VendorResponse> {
  const r = await client.query<Row>(
    `INSERT INTO vendors (id, tenant_id, name, contact_name, contact_email, phone, notes, metadata, linked_client_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) RETURNING *`,
    [
      p.id,
      p.tenantId,
      p.name,
      p.contact_name,
      p.contact_email,
      p.phone,
      p.notes,
      JSON.stringify(p.metadata),
      p.linked_client_id,
    ],
  );
  return map(r.rows[0]!);
}

export async function updateVendorRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    contact_name?: string | null;
    contact_email?: string | null;
    phone?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
    linked_client_id?: string | null;
  },
  expectedUpdatedAt?: string,
): Promise<VendorResponse | null> {
  if (patch.linked_client_id !== undefined && patch.linked_client_id !== null) {
    const c = await client.query(
      `SELECT 1 FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [tenantId, patch.linked_client_id],
    );
    if (c.rowCount === 0) return null;
  }
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  const fields = [
    "name",
    "contact_name",
    "contact_email",
    "phone",
    "notes",
  ] as const;
  for (const f of fields) {
    if (patch[f] !== undefined) {
      sets.push(`${f} = $${n}`);
      vals.push(patch[f]);
      n++;
    }
  }
  if (patch.linked_client_id !== undefined) {
    sets.push(`linked_client_id = $${n}`);
    vals.push(patch.linked_client_id);
    n++;
  }
  if (patch.metadata !== undefined) {
    sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${n}::jsonb`);
    vals.push(JSON.stringify(patch.metadata));
    n++;
  }
  if (sets.length === 0) {
    return getVendorById(client, tenantId, id);
  }
  sets.push(`updated_at = NOW()`);
  const w1 = vals.length + 1;
  const w2 = vals.length + 2;
  vals.push(tenantId, id);
  let where = `tenant_id = $${w1} AND id = $${w2} AND deleted_at IS NULL`;
  if (expectedUpdatedAt) {
    where += ` AND updated_at = $${w2 + 1}::timestamptz`;
    vals.push(expectedUpdatedAt);
  }
  const r = await client.query<Row>(
    `UPDATE vendors SET ${sets.join(", ")} WHERE ${where} RETURNING *`,
    vals,
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}

export async function softDeleteVendor(
  pool: Pool,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `UPDATE contacts SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND parent_type = 'vendor_organization' AND parent_id = $2 AND deleted_at IS NULL`,
      [tenantId, id],
    );
    const r = await c.query<{ id: string; deleted_at: Date }>(
      `UPDATE vendors SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, deleted_at`,
      [tenantId, id],
    );
    await c.query("COMMIT");
    if (!r.rows[0]) return null;
    return { id: r.rows[0].id, deleted_at: r.rows[0].deleted_at.toISOString() };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function updateVendorLinkedClient(
  client: Pool | PoolClient,
  tenantId: string,
  vendorId: string,
  linkedClientId: string | null,
): Promise<VendorResponse | null> {
  if (linkedClientId) {
    const c = await client.query(
      `SELECT 1 FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [tenantId, linkedClientId],
    );
    if (c.rowCount === 0) return null;
  }
  const r = await client.query<Row>(
    `UPDATE vendors SET linked_client_id = $3, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [tenantId, vendorId, linkedClientId],
  );
  return r.rows[0] ? map(r.rows[0]) : null;
}
