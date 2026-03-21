function isoDate(d) {
    if (d == null)
        return null;
    if (d instanceof Date)
        return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}
function isoDateTime(d) {
    return d.toISOString();
}
export function mapEventRow(r) {
    const tags = Array.isArray(r.tags)
        ? r.tags
        : typeof r.tags === "string"
            ? JSON.parse(r.tags)
            : [];
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    const customFields = r.custom_fields && typeof r.custom_fields === "object" && !Array.isArray(r.custom_fields)
        ? r.custom_fields
        : {};
    return {
        id: r.id,
        name: r.name,
        client_id: r.client_id,
        venue_id: r.venue_id,
        primary_contact_id: r.primary_contact_id ?? null,
        start_date: isoDate(r.start_date),
        end_date: isoDate(r.end_date),
        load_in_date: isoDate(r.load_in_date),
        load_out_date: isoDate(r.load_out_date),
        status: r.status,
        phase: r.phase,
        description: r.description,
        tags,
        metadata,
        custom_fields: customFields,
        created_at: isoDateTime(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
        updated_at: isoDateTime(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
        deleted_at: r.deleted_at
            ? isoDateTime(r.deleted_at instanceof Date ? r.deleted_at : new Date(r.deleted_at))
            : null,
    };
}
export async function findDuplicateEvent(client, tenantId, clientId, name, startDate, endDate, excludeId) {
    const r = await client.query(`SELECT EXISTS (
      SELECT 1 FROM events e
      WHERE e.tenant_id = $1 AND e.client_id = $2
        AND lower(e.name) = lower($3)
        AND e.deleted_at IS NULL
        AND ($6::uuid IS NULL OR e.id <> $6)
        AND daterange(e.start_date, e.end_date, '[]') && daterange($4::date, $5::date, '[]')
    ) AS dup`, [tenantId, clientId, name, startDate, endDate, excludeId ?? null]);
    return Boolean(r.rows[0]?.dup);
}
export async function insertEvent(client, params) {
    const r = await client.query(`INSERT INTO events (
      id, tenant_id, name, client_id, venue_id, primary_contact_id,
      start_date, end_date, load_in_date, load_out_date,
      status, phase, description, tags, metadata, custom_fields, created_by
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7::date,$8::date,$9::date,$10::date,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17
    )
    RETURNING *`, [
        params.id,
        params.tenantId,
        params.name,
        params.clientId,
        params.venueId,
        params.primaryContactId,
        params.startDate,
        params.endDate,
        params.loadIn,
        params.loadOut,
        params.status,
        params.phase,
        params.description,
        JSON.stringify(params.tags),
        JSON.stringify(params.metadata),
        JSON.stringify(params.customFields),
        params.createdBy,
    ]);
    return mapEventRow(r.rows[0]);
}
export async function getEventById(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM events WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ? mapEventRow(r.rows[0]) : null;
}
function sortColumn(sortBy) {
    switch (sortBy) {
        case "name":
            return { expr: "lower(e.name)", type: "text" };
        case "start_date":
            return { expr: "e.start_date", type: "date" };
        case "end_date":
            return { expr: "e.end_date", type: "date" };
        case "created_at":
            return { expr: "e.created_at", type: "ts" };
        case "updated_at":
            return { expr: "e.updated_at", type: "ts" };
        default:
            return { expr: "e.start_date", type: "date" };
    }
}
export async function countEvents(client, p) {
    const { where, values } = buildWhere(p);
    const r = await client.query(`SELECT count(*)::int AS c FROM events e ${where}`, values);
    return r.rows[0]?.c ?? 0;
}
function buildWhere(p) {
    const values = [p.tenantId];
    let i = 2;
    const parts = [`e.tenant_id = $1`, `e.deleted_at IS NULL`];
    if (p.status?.length) {
        parts.push(`e.status = ANY($${i}::text[])`);
        values.push(p.status);
        i++;
    }
    if (p.phase?.length) {
        parts.push(`e.phase = ANY($${i}::text[])`);
        values.push(p.phase);
        i++;
    }
    if (p.clientId) {
        parts.push(`e.client_id = $${i}`);
        values.push(p.clientId);
        i++;
    }
    if (p.venueId) {
        parts.push(`e.venue_id = $${i}`);
        values.push(p.venueId);
        i++;
    }
    if (p.dateRangeStart) {
        parts.push(`e.end_date >= $${i}::date`);
        values.push(p.dateRangeStart);
        i++;
    }
    if (p.dateRangeEnd) {
        parts.push(`e.start_date <= $${i}::date`);
        values.push(p.dateRangeEnd);
        i++;
    }
    if (p.search?.trim()) {
        parts.push(`(e.name ILIKE $${i} OR e.description ILIKE $${i} OR e.tags::text ILIKE $${i})`);
        values.push(`%${p.search.trim()}%`);
        i++;
    }
    return { where: `WHERE ${parts.join(" AND ")}`, values };
}
export async function listEvents(client, p) {
    const { where, values } = buildWhere(p);
    const col = sortColumn(p.sortBy);
    const dir = p.sortOrder === "desc" ? "DESC" : "ASC";
    const idDir = p.sortOrder === "desc" ? "DESC" : "ASC";
    const v = [...values];
    let cursorClause = "";
    if (p.cursorVal != null && p.cursorId != null) {
        const op = p.sortOrder === "desc" ? "<" : ">";
        const opEq = p.sortOrder === "desc" ? ">" : "<";
        const i = v.length + 1;
        if (col.type === "text") {
            cursorClause = ` AND ((${col.expr} ${op} $${i}) OR (${col.expr} = $${i} AND e.id ${opEq} $${i + 1}::uuid))`;
            v.push(p.cursorVal, p.cursorId);
        }
        else if (col.type === "date") {
            cursorClause = ` AND ((${col.expr} ${op} $${i}::date) OR (${col.expr} = $${i}::date AND e.id ${opEq} $${i + 1}::uuid))`;
            v.push(p.cursorVal, p.cursorId);
        }
        else {
            cursorClause = ` AND ((${col.expr} ${op} $${i}::timestamptz) OR (${col.expr} = $${i}::timestamptz AND e.id ${opEq} $${i + 1}::uuid))`;
            v.push(p.cursorVal, p.cursorId);
        }
    }
    const orderExpr = `${col.expr} ${dir}, e.id ${idDir}`;
    const sql = `
    SELECT e.* FROM events e
    ${where}${cursorClause}
    ORDER BY ${orderExpr}
    LIMIT $${v.length + 1}
  `;
    v.push(p.limit);
    const r = await client.query(sql, v);
    return r.rows.map(mapEventRow);
}
export async function updateEventRow(client, tenantId, id, patch, expectedUpdatedAt) {
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
    if (patch.client_id !== undefined)
        add("client_id", patch.client_id);
    if (patch.venue_id !== undefined)
        add("venue_id", patch.venue_id);
    if (patch.primary_contact_id !== undefined)
        add("primary_contact_id", patch.primary_contact_id);
    if (patch.start_date !== undefined)
        add("start_date", patch.start_date);
    if (patch.end_date !== undefined)
        add("end_date", patch.end_date);
    if (patch.load_in_date !== undefined)
        add("load_in_date", patch.load_in_date);
    if (patch.load_out_date !== undefined)
        add("load_out_date", patch.load_out_date);
    if (patch.status !== undefined)
        add("status", patch.status);
    if (patch.phase !== undefined)
        add("phase", patch.phase);
    if (patch.description !== undefined)
        add("description", patch.description);
    if (patch.tags !== undefined) {
        sets.push(`tags = $${n}::jsonb`);
        vals.push(JSON.stringify(patch.tags));
        n++;
    }
    if (patch.metadata !== undefined) {
        sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${n}::jsonb`);
        vals.push(JSON.stringify(patch.metadata));
        n++;
    }
    if (patch.custom_fields !== undefined) {
        sets.push(`custom_fields = $${n}::jsonb`);
        vals.push(JSON.stringify(patch.custom_fields));
        n++;
    }
    if (sets.length === 0) {
        if (expectedUpdatedAt) {
            const chk = await client.query(`SELECT * FROM events WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
         AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $3::timestamptz)`, [tenantId, id, expectedUpdatedAt]);
            return chk.rows[0] ? mapEventRow(chk.rows[0]) : null;
        }
        return getEventById(client, tenantId, id);
    }
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    let where = `tenant_id = $${n} AND id = $${n + 1} AND deleted_at IS NULL`;
    n += 2;
    if (expectedUpdatedAt) {
        where += ` AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $${n}::timestamptz)`;
        vals.push(expectedUpdatedAt);
    }
    const sql = `UPDATE events SET ${sets.join(", ")} WHERE ${where} RETURNING *`;
    const r = await client.query(sql, vals);
    return r.rows[0] ? mapEventRow(r.rows[0]) : null;
}
export async function updateEventPhaseRow(client, tenantId, id, phase) {
    const r = await client.query(`UPDATE events SET phase = $3, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING *`, [tenantId, id, phase]);
    return r.rows[0] ? mapEventRow(r.rows[0]) : null;
}
export async function softDeleteEvent(client, tenantId, id) {
    const r = await client.query(`UPDATE events SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`, [tenantId, id]);
    if (!r.rows[0])
        return null;
    return {
        id: r.rows[0].id,
        deleted_at: isoDateTime(r.rows[0].deleted_at instanceof Date
            ? r.rows[0].deleted_at
            : new Date(r.rows[0].deleted_at)),
    };
}
export async function selectEventsByDateRange(client, tenantId, start, end, status, phase) {
    const vals = [tenantId, start, end];
    let w = `WHERE e.tenant_id = $1 AND e.deleted_at IS NULL
    AND e.end_date >= $2::date AND e.start_date <= $3::date`;
    let i = 4;
    if (status?.length) {
        w += ` AND e.status = ANY($${i}::text[])`;
        vals.push(status);
        i++;
    }
    if (phase?.length) {
        w += ` AND e.phase = ANY($${i}::text[])`;
        vals.push(phase);
        i++;
    }
    const r = await client.query(`SELECT e.* FROM events e ${w} ORDER BY e.start_date ASC`, vals);
    return r.rows.map(mapEventRow);
}
export async function selectEventsByClient(client, tenantId, clientId, status, limit = 500) {
    const { where, values } = buildWhere({
        tenantId,
        status,
        clientId,
    });
    const r = await client.query(`SELECT e.* FROM events e ${where} ORDER BY e.start_date ASC LIMIT ${limit}`, values);
    return r.rows.map(mapEventRow);
}
/** Includes soft-deleted rows (deleted_at set). */
export async function getEventRowByIdAnyDeletedState(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM events WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    return r.rows[0] ? mapEventRow(r.rows[0]) : null;
}
export async function restoreSoftDeletedEventRow(client, tenantId, id) {
    const r = await client.query(`UPDATE events SET deleted_at = NULL, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NOT NULL
     RETURNING *`, [tenantId, id]);
    return r.rows[0] ? mapEventRow(r.rows[0]) : null;
}
