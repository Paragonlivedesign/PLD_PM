export function mapDepartmentRow(r, personnelCount) {
    const hn = r.head_name;
    return {
        id: String(r.id),
        name: String(r.name),
        description: r.description === null || r.description === undefined ? null : String(r.description),
        head_id: r.head_id ? String(r.head_id) : null,
        head_name: hn !== null && hn !== undefined ? String(hn) : null,
        color: r.color ? String(r.color) : null,
        personnel_count: personnelCount,
        created_at: new Date(String(r.created_at)).toISOString(),
        updated_at: new Date(String(r.updated_at)).toISOString(),
    };
}
export async function insertDepartment(db, row) {
    const q = `
    INSERT INTO departments (id, tenant_id, name, description, head_id, color)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id
  `;
    await db.query(q, [
        row.id,
        row.tenant_id,
        row.name,
        row.description,
        row.head_id,
        row.color,
    ]);
    const full = await findDepartmentById(db, row.tenant_id, row.id, false);
    if (!full)
        throw new Error("insertDepartment: not found after insert");
    return full;
}
export async function findDepartmentById(db, tenantId, id, includeCounts) {
    const q = `
    SELECT d.*, hp.first_name AS head_first, hp.last_name AS head_last
    FROM departments d
    LEFT JOIN personnel hp ON hp.id = d.head_id AND hp.tenant_id = d.tenant_id AND hp.deleted_at IS NULL
    WHERE d.tenant_id = $1 AND d.id = $2 AND d.deleted_at IS NULL
  `;
    const res = await db.query(q, [tenantId, id]);
    if (res.rows.length === 0)
        return null;
    const r = res.rows[0];
    let count = null;
    if (includeCounts) {
        const c = await db.query(`SELECT COUNT(*)::int AS c FROM personnel WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL`, [tenantId, id]);
        count = Number(c.rows[0].c);
    }
    const headName = r.head_first && r.head_last
        ? `${String(r.head_first)} ${String(r.head_last)}`
        : null;
    return mapDepartmentRow({ ...r, head_name: headName }, count);
}
export async function listDepartments(db, tenantId, includeCounts) {
    const q = `
    SELECT d.*, hp.first_name AS head_first, hp.last_name AS head_last
    FROM departments d
    LEFT JOIN personnel hp ON hp.id = d.head_id AND hp.tenant_id = d.tenant_id AND hp.deleted_at IS NULL
    WHERE d.tenant_id = $1 AND d.deleted_at IS NULL
    ORDER BY lower(d.name) ASC
  `;
    const res = await db.query(q, [tenantId]);
    const rows = [];
    for (const row of res.rows) {
        const r = row;
        let count = null;
        if (includeCounts) {
            const c = await db.query(`SELECT COUNT(*)::int AS c FROM personnel WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL`, [tenantId, r.id]);
            count = Number(c.rows[0].c);
        }
        const headName = r.head_first && r.head_last
            ? `${String(r.head_first)} ${String(r.head_last)}`
            : null;
        rows.push(mapDepartmentRow({ ...r, head_name: headName }, count));
    }
    return rows;
}
export async function updateDepartment(db, tenantId, id, patch) {
    const sets = [];
    const vals = [];
    let n = 1;
    const add = (col, val) => {
        sets.push(`${col} = $${n}`);
        vals.push(val);
        n++;
    };
    if (patch.name !== undefined)
        add("name", patch.name);
    if (patch.description !== undefined)
        add("description", patch.description);
    if (patch.head_id !== undefined)
        add("head_id", patch.head_id);
    if (patch.color !== undefined)
        add("color", patch.color);
    if (sets.length === 0)
        return findDepartmentById(db, tenantId, id, false);
    sets.push("updated_at = NOW()");
    const iTenant = n;
    const iId = n + 1;
    vals.push(tenantId, id);
    const q = `UPDATE departments SET ${sets.join(", ")} WHERE tenant_id = $${iTenant} AND id = $${iId} AND deleted_at IS NULL RETURNING id`;
    const res = await db.query(q, vals);
    if (res.rows.length === 0)
        return null;
    return findDepartmentById(db, tenantId, id, false);
}
export async function softDeleteDepartment(db, tenantId, id) {
    const q = `
    UPDATE departments SET deleted_at = NOW(), updated_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
    RETURNING id, deleted_at
  `;
    const res = await db.query(q, [tenantId, id]);
    if (res.rows.length === 0)
        return null;
    return {
        id: String(res.rows[0].id),
        deleted_at: new Date(String(res.rows[0].deleted_at)).toISOString(),
    };
}
export async function countPersonnelInDepartment(db, tenantId, departmentId) {
    const q = `
    SELECT COUNT(*)::int AS c FROM personnel
    WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL
  `;
    const res = await db.query(q, [tenantId, departmentId]);
    return Number(res.rows[0].c);
}
