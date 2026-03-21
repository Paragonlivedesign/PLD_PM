import type pg from "pg";

export type TenantUserSummary = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_name: string;
  is_active: boolean;
};

export type TenantWithUsersRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: Date;
  users: TenantUserSummary[];
};

export async function listAllTenantsWithUsers(pool: pg.Pool): Promise<TenantWithUsersRow[]> {
  const tenantsRes = await pool.query<{
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: Date;
  }>(
    `SELECT id, name, slug, status, created_at
     FROM tenants
     ORDER BY name ASC`,
  );

  const tenants = tenantsRes.rows;
  if (tenants.length === 0) return [];

  const usersRes = await pool.query<{
    id: string;
    tenant_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role_name: string;
    is_active: boolean;
  }>(
    `SELECT u.id, u.tenant_id, u.email, u.first_name, u.last_name, r.name AS role_name, u.is_active
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL
     WHERE u.deleted_at IS NULL
     ORDER BY u.tenant_id, lower(u.email)`,
  );

  const byTenant = new Map<string, TenantUserSummary[]>();
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
