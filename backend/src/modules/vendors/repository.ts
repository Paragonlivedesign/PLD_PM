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
): Promise<VendorResponse[]> {
  const r = await client.query<Row>(
    `SELECT * FROM vendors WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY lower(name) ASC LIMIT $2`,
    [tenantId, limit],
  );
  return r.rows.map(map);
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
