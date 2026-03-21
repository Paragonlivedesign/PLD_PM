function map(r) {
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
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
export async function getVendorById(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM vendors WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ? map(r.rows[0]) : null;
}
export async function listVendors(client, tenantId, limit) {
    const r = await client.query(`SELECT * FROM vendors WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY lower(name) ASC LIMIT $2`, [tenantId, limit]);
    return r.rows.map(map);
}
export async function updateVendorLinkedClient(client, tenantId, vendorId, linkedClientId) {
    if (linkedClientId) {
        const c = await client.query(`SELECT 1 FROM clients WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, linkedClientId]);
        if (c.rowCount === 0)
            return null;
    }
    const r = await client.query(`UPDATE vendors SET linked_client_id = $3, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`, [tenantId, vendorId, linkedClientId]);
    return r.rows[0] ? map(r.rows[0]) : null;
}
