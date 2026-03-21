export async function listAllTenantsWithUsers(pool) {
    const tenantsRes = await pool.query(`SELECT id, name, slug, status, created_at
     FROM tenants
     ORDER BY name ASC`);
    const tenants = tenantsRes.rows;
    if (tenants.length === 0)
        return [];
    const usersRes = await pool.query(`SELECT u.id, u.tenant_id, u.email, u.first_name, u.last_name, r.name AS role_name, u.is_active
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL
     WHERE u.deleted_at IS NULL
     ORDER BY u.tenant_id, lower(u.email)`);
    const byTenant = new Map();
    for (const row of usersRes.rows) {
        const list = byTenant.get(row.tenant_id) ?? [];
        list.push({
            id: row.id,
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            role_name: row.role_name,
            is_active: row.is_active,
        });
        byTenant.set(row.tenant_id, list);
    }
    return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        created_at: t.created_at,
        users: byTenant.get(t.id) ?? [],
    }));
}
