import { randomUUID } from "node:crypto";
function sortExpr(sortBy, order) {
    const dir = order === "asc" ? "ASC" : "DESC";
    switch (sortBy) {
        case "name":
            return `ORDER BY lower(d.name) ${dir}, d.id ${dir}`;
        case "category":
            return `ORDER BY d.category ${dir}, d.id ${dir}`;
        case "size":
            return `ORDER BY d.size_bytes ${dir}, d.id ${dir}`;
        case "created_at":
        default:
            return `ORDER BY d.created_at ${dir}, d.id ${dir}`;
    }
}
export async function insertDocument(pool, row) {
    const res = await pool.query(`INSERT INTO documents (
      id, tenant_id, event_id, entity_type, entity_id, category, name, description,
      source, visibility, mime_type, size_bytes, storage_key, tags,
      generated_from_template_id, doc_version, uploaded_by, processing_status, stale
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19)
    RETURNING *`, [
        row.id,
        row.tenant_id,
        row.event_id,
        row.entity_type,
        row.entity_id,
        row.category,
        row.name,
        row.description,
        row.source,
        row.visibility,
        row.mime_type,
        row.size_bytes,
        row.storage_key,
        JSON.stringify(row.tags ?? []),
        row.generated_from_template_id,
        row.doc_version,
        row.uploaded_by,
        row.processing_status,
        row.stale ?? false,
    ]);
    return mapDoc(res.rows[0]);
}
export async function getDocumentById(pool, tenantId, id, includeDeleted = false) {
    const del = includeDeleted ? "" : "AND d.deleted_at IS NULL";
    const res = await pool.query(`SELECT d.* FROM documents d WHERE d.tenant_id = $1 AND d.id = $2 ${del}`, [tenantId, id]);
    if (!res.rows[0])
        return null;
    return mapDoc(res.rows[0]);
}
export async function softDeleteDocument(pool, tenantId, id) {
    const res = await pool.query(`UPDATE documents SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`, [tenantId, id]);
    if (!res.rows[0])
        return null;
    const r = res.rows[0];
    return { id: r.id, deleted_at: r.deleted_at.toISOString() };
}
export async function listDocuments(pool, tenantId, p) {
    const conds = ["d.tenant_id = $1", "d.deleted_at IS NULL"];
    const vals = [tenantId];
    let n = 2;
    if (p.event_id) {
        conds.push(`d.event_id = $${n}`);
        vals.push(p.event_id);
        n++;
    }
    if (p.entity_type) {
        conds.push(`d.entity_type = $${n}`);
        vals.push(p.entity_type);
        n++;
    }
    if (p.entity_id) {
        conds.push(`d.entity_id = $${n}`);
        vals.push(p.entity_id);
        n++;
    }
    if (p.category?.length) {
        conds.push(`d.category = ANY($${n}::text[])`);
        vals.push(p.category);
        n++;
    }
    if (p.visibility?.length) {
        conds.push(`d.visibility = ANY($${n}::text[])`);
        vals.push(p.visibility);
        n++;
    }
    if (p.source) {
        conds.push(`d.source = $${n}`);
        vals.push(p.source);
        n++;
    }
    if (p.search?.trim()) {
        conds.push(`(d.name ILIKE $${n} OR d.description ILIKE $${n} OR d.tags::text ILIKE $${n})`);
        vals.push(`%${p.search.trim()}%`);
        n++;
    }
    if (p.cursor) {
        const { v, id } = p.cursor;
        const desc = p.sort_order === "desc";
        const idOp = desc ? "<" : ">";
        if (p.sort_by === "created_at") {
            const tOp = desc ? "<" : ">";
            conds.push(`(d.created_at ${tOp} $${n}::timestamptz OR (d.created_at = $${n}::timestamptz AND d.id ${idOp} $${n + 1}::uuid))`);
            vals.push(v, id);
            n += 2;
        }
        else if (p.sort_by === "name") {
            const tOp = desc ? "<" : ">";
            conds.push(`(lower(d.name) ${tOp} lower($${n}::text) OR (lower(d.name) = lower($${n}::text) AND d.id ${idOp} $${n + 1}::uuid))`);
            vals.push(v, id);
            n += 2;
        }
        else if (p.sort_by === "category") {
            const tOp = desc ? "<" : ">";
            conds.push(`(d.category ${tOp} $${n}::text OR (d.category = $${n}::text AND d.id ${idOp} $${n + 1}::uuid))`);
            vals.push(v, id);
            n += 2;
        }
        else {
            const tOp = desc ? "<" : ">";
            conds.push(`(d.size_bytes ${tOp} $${n}::bigint OR (d.size_bytes = $${n}::bigint AND d.id ${idOp} $${n + 1}::uuid))`);
            vals.push(v, id);
            n += 2;
        }
    }
    const where = conds.join(" AND ");
    const ob = sortExpr(p.sort_by, p.sort_order);
    const countRes = await pool.query(`SELECT count(*)::int AS c FROM documents d WHERE ${where}`, vals);
    const total = countRes.rows[0]?.c ?? 0;
    const limIdx = vals.length + 1;
    const q = `SELECT d.* FROM documents d WHERE ${where} ${ob} LIMIT $${limIdx}`;
    const res = await pool.query(q, [...vals, p.limit + 1]);
    const rows = res.rows.map((r) => mapDoc(r));
    return { rows, total };
}
export async function markGeneratedStaleForEvent(pool, tenantId, eventId) {
    const res = await pool.query(`UPDATE documents SET stale = TRUE, updated_at = NOW()
     WHERE tenant_id = $1 AND event_id = $2 AND source = 'generated' AND deleted_at IS NULL`, [tenantId, eventId]);
    return res.rowCount ?? 0;
}
export async function markAllGeneratedStaleForTenant(pool, tenantId) {
    const res = await pool.query(`UPDATE documents SET stale = TRUE, updated_at = NOW()
     WHERE tenant_id = $1 AND source = 'generated' AND deleted_at IS NULL`, [tenantId]);
    return res.rowCount ?? 0;
}
function mapDoc(r) {
    return {
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        event_id: r.event_id ? String(r.event_id) : null,
        entity_type: r.entity_type != null ? String(r.entity_type) : null,
        entity_id: r.entity_id ? String(r.entity_id) : null,
        category: String(r.category),
        name: String(r.name),
        description: r.description != null ? String(r.description) : null,
        source: String(r.source),
        visibility: String(r.visibility),
        mime_type: String(r.mime_type),
        size_bytes: String(r.size_bytes),
        storage_key: String(r.storage_key),
        tags: r.tags,
        generated_from_template_id: r.generated_from_template_id
            ? String(r.generated_from_template_id)
            : null,
        doc_version: Number(r.doc_version),
        uploaded_by: String(r.uploaded_by),
        processing_status: String(r.processing_status),
        stale: Boolean(r.stale),
        deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : null,
        created_at: new Date(r.created_at).toISOString(),
        updated_at: new Date(r.updated_at).toISOString(),
    };
}
export function documentCursor(row, sortBy) {
    let v;
    switch (sortBy) {
        case "name":
            v = row.name.toLowerCase();
            break;
        case "category":
            v = row.category;
            break;
        case "size":
            v = row.size_bytes;
            break;
        case "created_at":
        default:
            v = row.created_at;
            break;
    }
    return Buffer.from(JSON.stringify({ v, id: row.id, sb: sortBy }), "utf8").toString("base64url");
}
export function decodeDocumentCursor(raw) {
    if (!raw?.trim())
        return null;
    try {
        const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        const keys = ["name", "created_at", "category", "size"];
        if (j.v != null && j.id != null && j.sb != null && keys.includes(j.sb)) {
            return { v: j.v, id: j.id, sortBy: j.sb };
        }
    }
    catch {
        /* ignore */
    }
    return null;
}
// --- templates ---
export async function insertTemplate(pool, row) {
    const res = await pool.query(`INSERT INTO document_templates (
      id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`, [
        row.id,
        row.tenant_id,
        row.name,
        row.description,
        row.category,
        row.content,
        row.format,
        JSON.stringify(row.variables ?? []),
        row.default_output_format,
        row.is_active,
    ]);
    return mapTpl(res.rows[0]);
}
export async function updateTemplate(pool, tenantId, id, patch) {
    const sets = [];
    const vals = [];
    let n = 1;
    let bumpVersion = false;
    if (patch.name !== undefined) {
        sets.push(`name = $${n}`);
        vals.push(patch.name);
        n++;
    }
    if (patch.description !== undefined) {
        sets.push(`description = $${n}`);
        vals.push(patch.description);
        n++;
    }
    if (patch.category !== undefined) {
        sets.push(`category = $${n}`);
        vals.push(patch.category);
        n++;
    }
    if (patch.content !== undefined) {
        sets.push(`content = $${n}`);
        vals.push(patch.content);
        n++;
        bumpVersion = true;
    }
    if (patch.format !== undefined) {
        sets.push(`format = $${n}`);
        vals.push(patch.format);
        n++;
    }
    if (patch.variables !== undefined) {
        sets.push(`variables = $${n}::jsonb`);
        vals.push(JSON.stringify(patch.variables));
        n++;
    }
    if (patch.default_output_format !== undefined) {
        sets.push(`default_output_format = $${n}`);
        vals.push(patch.default_output_format);
        n++;
    }
    if (patch.is_active !== undefined) {
        sets.push(`is_active = $${n}`);
        vals.push(patch.is_active);
        n++;
    }
    if (bumpVersion)
        sets.push(`version = version + 1`);
    if (sets.length === 0)
        return getTemplateById(pool, tenantId, id);
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    const res = await pool.query(`UPDATE document_templates SET ${sets.join(", ")}
     WHERE tenant_id = $${n} AND id = $${n + 1} RETURNING *`, vals);
    if (!res.rows[0])
        return null;
    return mapTpl(res.rows[0]);
}
export async function getTemplateById(pool, tenantId, id) {
    const res = await pool.query(`SELECT * FROM document_templates WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!res.rows[0])
        return null;
    return mapTpl(res.rows[0]);
}
export async function listTemplates(pool, tenantId, options) {
    const conds = ["tenant_id = $1"];
    const vals = [tenantId];
    let n = 2;
    if (options.active_only !== false) {
        conds.push("is_active = TRUE");
    }
    if (options.category?.length) {
        conds.push(`category = ANY($${n}::text[])`);
        vals.push(options.category);
        n++;
    }
    if (options.search?.trim()) {
        conds.push(`(name ILIKE $${n} OR description ILIKE $${n})`);
        vals.push(`%${options.search.trim()}%`);
        n++;
    }
    const ob = options.sort_by === "created_at"
        ? `ORDER BY created_at ${options.sort_order === "desc" ? "DESC" : "ASC"}, id`
        : options.sort_by === "category"
            ? `ORDER BY category ${options.sort_order === "desc" ? "DESC" : "ASC"}, lower(name), id`
            : `ORDER BY lower(name) ${options.sort_order === "desc" ? "DESC" : "ASC"}, id`;
    const res = await pool.query(`SELECT * FROM document_templates WHERE ${conds.join(" AND ")} ${ob}`, vals);
    return res.rows.map((r) => mapTpl(r));
}
function mapTpl(r) {
    return {
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        name: String(r.name),
        description: r.description != null ? String(r.description) : null,
        category: String(r.category),
        content: String(r.content),
        format: String(r.format),
        variables: r.variables,
        default_output_format: String(r.default_output_format),
        version: Number(r.version),
        is_active: Boolean(r.is_active),
        created_at: new Date(r.created_at).toISOString(),
        updated_at: new Date(r.updated_at).toISOString(),
    };
}
// --- rider ---
export async function insertRiderItems(pool, items) {
    if (items.length === 0)
        return [];
    const out = [];
    for (const it of items) {
        const res = await pool.query(`INSERT INTO rider_items (
        id, tenant_id, document_id, event_id, description, category, quantity, status, notes, assigned_to, estimated_cost, source_line
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [
            it.id,
            it.tenant_id,
            it.document_id,
            it.event_id,
            it.description,
            it.category,
            it.quantity,
            it.status,
            it.notes,
            it.assigned_to,
            it.estimated_cost,
            it.source_line,
        ]);
        out.push(mapRider(res.rows[0]));
    }
    return out;
}
export async function listRiderItems(pool, tenantId, filters) {
    const conds = ["tenant_id = $1"];
    const vals = [tenantId];
    let n = 2;
    if (filters.event_id) {
        conds.push(`event_id = $${n}`);
        vals.push(filters.event_id);
        n++;
    }
    if (filters.document_id) {
        conds.push(`document_id = $${n}`);
        vals.push(filters.document_id);
        n++;
    }
    if (filters.category) {
        conds.push(`category = $${n}`);
        vals.push(filters.category);
        n++;
    }
    if (filters.status) {
        conds.push(`status = $${n}`);
        vals.push(filters.status);
        n++;
    }
    if (filters.search?.trim()) {
        conds.push(`description ILIKE $${n}`);
        vals.push(`%${filters.search.trim()}%`);
        n++;
    }
    const where = conds.join(" AND ");
    const countRes = await pool.query(`SELECT count(*)::int AS c FROM rider_items WHERE ${where}`, vals);
    const total = countRes.rows[0]?.c ?? 0;
    const iLim = vals.length + 1;
    const iOff = vals.length + 2;
    const res = await pool.query(`SELECT * FROM rider_items WHERE ${where} ORDER BY created_at DESC, id LIMIT $${iLim} OFFSET $${iOff}`, [...vals, filters.limit, filters.offset]);
    return { rows: res.rows.map((r) => mapRider(r)), total };
}
export async function getRiderById(pool, tenantId, id) {
    const res = await pool.query(`SELECT * FROM rider_items WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    if (!res.rows[0])
        return null;
    return mapRider(res.rows[0]);
}
export async function updateRiderItem(pool, tenantId, id, patch) {
    const sets = [];
    const vals = [];
    let n = 1;
    if (patch.category !== undefined) {
        sets.push(`category = $${n}`);
        vals.push(patch.category);
        n++;
    }
    if (patch.status !== undefined) {
        sets.push(`status = $${n}`);
        vals.push(patch.status);
        n++;
    }
    if (patch.quantity !== undefined) {
        sets.push(`quantity = $${n}`);
        vals.push(patch.quantity);
        n++;
    }
    if (patch.notes !== undefined) {
        sets.push(`notes = $${n}`);
        vals.push(patch.notes);
        n++;
    }
    if (patch.assigned_to !== undefined) {
        sets.push(`assigned_to = $${n}`);
        vals.push(patch.assigned_to);
        n++;
    }
    if (patch.estimated_cost !== undefined) {
        sets.push(`estimated_cost = $${n}`);
        vals.push(patch.estimated_cost);
        n++;
    }
    if (sets.length === 0)
        return getRiderById(pool, tenantId, id);
    sets.push("updated_at = NOW()");
    const ti = n;
    const ii = n + 1;
    vals.push(tenantId, id);
    const res = await pool.query(`UPDATE rider_items SET ${sets.join(", ")} WHERE tenant_id = $${ti} AND id = $${ii} RETURNING *`, vals);
    if (!res.rows[0])
        return null;
    return mapRider(res.rows[0]);
}
function mapRider(r) {
    return {
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        document_id: String(r.document_id),
        event_id: String(r.event_id),
        description: String(r.description),
        category: String(r.category),
        quantity: Number(r.quantity),
        status: String(r.status),
        notes: r.notes != null ? String(r.notes) : null,
        assigned_to: r.assigned_to ? String(r.assigned_to) : null,
        estimated_cost: r.estimated_cost != null ? String(r.estimated_cost) : null,
        source_line: r.source_line != null ? String(r.source_line) : null,
        created_at: new Date(r.created_at).toISOString(),
        updated_at: new Date(r.updated_at).toISOString(),
    };
}
// --- email drafts ---
export async function insertEmailDraft(pool, row) {
    const res = await pool.query(`INSERT INTO email_drafts (
      id, tenant_id, event_id, template_id, to_addresses, cc_addresses, subject, body_html, body_text, attachments, status
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11) RETURNING *`, [
        row.id,
        row.tenant_id,
        row.event_id,
        row.template_id,
        JSON.stringify(row.to_addresses),
        JSON.stringify(row.cc_addresses),
        row.subject,
        row.body_html,
        row.body_text,
        JSON.stringify(row.attachments ?? []),
        row.status,
    ]);
    return mapEmail(res.rows[0]);
}
function mapEmail(r) {
    return {
        id: String(r.id),
        tenant_id: String(r.tenant_id),
        event_id: String(r.event_id),
        template_id: r.template_id ? String(r.template_id) : null,
        to_addresses: r.to_addresses,
        cc_addresses: r.cc_addresses,
        subject: String(r.subject),
        body_html: String(r.body_html),
        body_text: String(r.body_text),
        attachments: r.attachments,
        status: String(r.status),
        created_at: new Date(r.created_at).toISOString(),
    };
}
export function newId() {
    return randomUUID();
}
