import { syncPersonFromContactFields } from "./person-repository.js";
function map(r) {
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    return {
        id: r.id,
        parent_type: r.parent_type,
        parent_id: r.parent_id,
        person_id: r.person_id ?? null,
        personnel_id: r.personnel_id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        title: r.title,
        is_primary: r.is_primary,
        metadata,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
        deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
    };
}
export async function listContactsForParent(client, tenantId, parentType, parentId) {
    const r = await client.query(`SELECT * FROM contacts
     WHERE tenant_id = $1 AND parent_type = $2 AND parent_id = $3 AND deleted_at IS NULL
     ORDER BY is_primary DESC, name ASC`, [tenantId, parentType, parentId]);
    return r.rows.map(map);
}
export async function getContactById(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM contacts WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ? map(r.rows[0]) : null;
}
export async function insertContact(client, p) {
    if (p.isPrimary) {
        await client.query(`UPDATE contacts SET is_primary = FALSE, updated_at = NOW()
       WHERE tenant_id = $1 AND parent_type = $2 AND parent_id = $3 AND deleted_at IS NULL`, [p.tenantId, p.parentType, p.parentId]);
    }
    const r = await client.query(`INSERT INTO contacts (
      id, tenant_id, parent_type, parent_id, person_id, personnel_id,
      name, email, phone, title, is_primary, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
    RETURNING *`, [
        p.id,
        p.tenantId,
        p.parentType,
        p.parentId,
        p.personId,
        p.personnelId,
        p.name,
        p.email,
        p.phone,
        p.title,
        p.isPrimary,
        JSON.stringify(p.metadata),
    ]);
    return map(r.rows[0]);
}
export async function updateContactRow(client, tenantId, id, patch, parentType, parentId) {
    if (patch.is_primary === true) {
        await client.query(`UPDATE contacts SET is_primary = FALSE, updated_at = NOW()
       WHERE tenant_id = $1 AND parent_type = $2 AND parent_id = $3 AND deleted_at IS NULL AND id <> $4::uuid`, [tenantId, parentType, parentId, id]);
    }
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
    if (patch.email !== undefined)
        add("email", patch.email);
    if (patch.phone !== undefined)
        add("phone", patch.phone);
    if (patch.title !== undefined)
        add("title", patch.title);
    if (patch.personnel_id !== undefined)
        add("personnel_id", patch.personnel_id);
    if (patch.is_primary !== undefined)
        add("is_primary", patch.is_primary);
    if (patch.metadata !== undefined) {
        sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${n}::jsonb`);
        vals.push(JSON.stringify(patch.metadata));
        n++;
    }
    if (sets.length === 0) {
        return getContactById(client, tenantId, id);
    }
    sets.push("updated_at = NOW()");
    const whereStart = n;
    vals.push(tenantId, id, parentType, parentId);
    const sql = `UPDATE contacts SET ${sets.join(", ")}
     WHERE tenant_id = $${whereStart} AND id = $${whereStart + 1}::uuid AND parent_type = $${whereStart + 2} AND parent_id = $${whereStart + 3}::uuid AND deleted_at IS NULL
     RETURNING *`;
    const r = await client.query(sql, vals);
    const row = r.rows[0];
    if (!row)
        return null;
    if (row.person_id) {
        await syncPersonFromContactFields(client, tenantId, row.person_id, row.name, row.email, row.phone, row.personnel_id);
    }
    return map(row);
}
export async function softDeleteContact(client, tenantId, id, parentType, parentId) {
    const r = await client.query(`UPDATE contacts SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND parent_type = $3 AND parent_id = $4::uuid AND deleted_at IS NULL
     RETURNING *`, [tenantId, id, parentType, parentId]);
    return r.rows[0] ? map(r.rows[0]) : null;
}
