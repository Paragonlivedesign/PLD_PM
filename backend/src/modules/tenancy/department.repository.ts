import type { Pool, PoolClient } from "pg";
import type { DepartmentResponse } from "./types.js";

export type Db = Pool | PoolClient;

export function mapDepartmentRow(
  r: Record<string, unknown>,
  personnelCount: number | null,
): DepartmentResponse {
  const hn = r.head_name;
  const sortOrder = r.sort_order != null ? Number(r.sort_order) : 0;
  const isActive = r.is_active === undefined ? true : Boolean(r.is_active);
  return {
    id: String(r.id),
    name: String(r.name),
    description: r.description === null || r.description === undefined ? null : String(r.description),
    sort_order: sortOrder,
    is_active: isActive,
    head_id: r.head_id ? String(r.head_id) : null,
    head_name: hn !== null && hn !== undefined ? String(hn) : null,
    color: r.color ? String(r.color) : null,
    personnel_count: personnelCount,
    created_at: new Date(String(r.created_at)).toISOString(),
    updated_at: new Date(String(r.updated_at)).toISOString(),
  };
}

export async function nextDepartmentSortOrder(db: Db, tenantId: string): Promise<number> {
  const res = await db.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function insertDepartment(
  db: Db,
  row: {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    head_id: string | null;
    color: string | null;
    sort_order: number;
    is_active: boolean;
  },
): Promise<DepartmentResponse> {
  const q = `
    INSERT INTO departments (id, tenant_id, name, description, head_id, color, sort_order, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
  `;
  await db.query(q, [
    row.id,
    row.tenant_id,
    row.name,
    row.description,
    row.head_id,
    row.color,
    row.sort_order,
    row.is_active,
  ]);
  const full = await findDepartmentById(db, row.tenant_id, row.id, false);
  if (!full) throw new Error("insertDepartment: not found after insert");
  return full;
}

export async function findDepartmentById(
  db: Db,
  tenantId: string,
  id: string,
  includeCounts: boolean,
): Promise<DepartmentResponse | null> {
  const q = `
    SELECT d.*, hp.first_name AS head_first, hp.last_name AS head_last
    FROM departments d
    LEFT JOIN personnel hp ON hp.id = d.head_id AND hp.tenant_id = d.tenant_id AND hp.deleted_at IS NULL
    WHERE d.tenant_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
  `;
  const res = await db.query(q, [tenantId, id]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0] as Record<string, unknown>;
  let count: number | null = null;
  if (includeCounts) {
    const c = await db.query(
      `SELECT COUNT(*)::int AS c FROM personnel WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL`,
      [tenantId, id],
    );
    count = Number(c.rows[0].c);
  }
  const headName =
    r.head_first && r.head_last
      ? `${String(r.head_first)} ${String(r.head_last)}`
      : null;
  return mapDepartmentRow({ ...r, head_name: headName }, count);
}

export type ListDepartmentsFilters = "active_only" | "all" | "inactive_only";

export async function listDepartments(
  db: Db,
  tenantId: string,
  filter: ListDepartmentsFilters,
  includeCounts: boolean,
): Promise<DepartmentResponse[]> {
  let activeClause = "";
  if (filter === "active_only") {
    activeClause = " AND d.is_active = true ";
  } else if (filter === "inactive_only") {
    activeClause = " AND d.is_active = false ";
  }
  const q = `
    SELECT d.*, hp.first_name AS head_first, hp.last_name AS head_last
    FROM departments d
    LEFT JOIN personnel hp ON hp.id = d.head_id AND hp.tenant_id = d.tenant_id AND hp.deleted_at IS NULL
    WHERE d.tenant_id = $1 AND d.deleted_at IS NULL ${activeClause}
    ORDER BY d.sort_order ASC, lower(d.name) ASC
  `;
  const res = await db.query(q, [tenantId]);
  const rows: DepartmentResponse[] = [];
  for (const row of res.rows) {
    const r = row as Record<string, unknown>;
    let count: number | null = null;
    if (includeCounts) {
      const c = await db.query(
        `SELECT COUNT(*)::int AS c FROM personnel WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL`,
        [tenantId, r.id],
      );
      count = Number(c.rows[0].c);
    }
    const headName =
      r.head_first && r.head_last
        ? `${String(r.head_first)} ${String(r.head_last)}`
        : null;
    rows.push(mapDepartmentRow({ ...r, head_name: headName }, count));
  }
  return rows;
}

export async function updateDepartment(
  db: Db,
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    description?: unknown;
    head_id?: unknown;
    color?: unknown;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<DepartmentResponse | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${n}`);
    vals.push(val);
    n++;
  };
  if (patch.name !== undefined) add("name", patch.name);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.head_id !== undefined) add("head_id", patch.head_id);
  if (patch.color !== undefined) add("color", patch.color);
  if (patch.sort_order !== undefined) add("sort_order", patch.sort_order);
  if (patch.is_active !== undefined) add("is_active", patch.is_active);
  if (sets.length === 0) return findDepartmentById(db, tenantId, id, false);
  sets.push("updated_at = NOW()");
  const iTenant = n;
  const iId = n + 1;
  vals.push(tenantId, id);
  const q = `UPDATE departments SET ${sets.join(", ")} WHERE tenant_id = $${iTenant} AND id = $${iId} AND deleted_at IS NULL RETURNING id`;
  const res = await db.query(q, vals);
  if (res.rows.length === 0) return null;
  return findDepartmentById(db, tenantId, id, false);
}

export async function softDeleteDepartment(
  db: Db,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const q = `
    UPDATE departments SET deleted_at = NOW(), updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
    RETURNING id, deleted_at
  `;
  const res = await db.query(q, [tenantId, id]);
  if (res.rows.length === 0) return null;
  return {
    id: String(res.rows[0].id),
    deleted_at: new Date(String(res.rows[0].deleted_at)).toISOString(),
  };
}

export async function countPersonnelInDepartment(
  db: Db,
  tenantId: string,
  departmentId: string,
): Promise<number> {
  const q = `
    SELECT COUNT(*)::int AS c FROM personnel
    WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL
  `;
  const res = await db.query(q, [tenantId, departmentId]);
  return Number(res.rows[0].c);
}

export async function countCrewAssignmentsForDepartment(
  db: Db,
  tenantId: string,
  departmentId: string,
): Promise<number> {
  const q = `
    SELECT COUNT(*)::int AS c FROM crew_assignments
    WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL
  `;
  const res = await db.query(q, [tenantId, departmentId]);
  return Number(res.rows[0]?.c ?? 0);
}

export async function reorderDepartments(pool: Pool, tenantId: string, orderedIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let order = 0;
    for (const id of orderedIds) {
      await client.query(
        `UPDATE departments SET sort_order = $1, updated_at = NOW()
         WHERE tenant_id = $2 AND id = $3 AND deleted_at IS NULL`,
        [order, tenantId, id],
      );
      order++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
