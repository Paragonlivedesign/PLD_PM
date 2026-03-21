function map(r) {
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    return {
        id: r.id,
        name: r.name,
        city: r.city,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
        notes: r.notes,
        metadata,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
        deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
    };
}
export async function getVenueById(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM venues WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ? map(r.rows[0]) : null;
}
export async function insertVenue(client, p) {
    const r = await client.query(`INSERT INTO venues (id, tenant_id, name, city, address, latitude, longitude, timezone, notes, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`, [
        p.id,
        p.tenantId,
        p.name,
        p.city,
        p.address,
        p.latitude,
        p.longitude,
        p.timezone,
        p.notes,
        JSON.stringify(p.metadata),
    ]);
    return map(r.rows[0]);
}
export async function updateVenueRow(client, tenantId, id, patch, expectedUpdatedAt) {
    const sets = [];
    const vals = [];
    let n = 1;
    const fields = [
        "name",
        "city",
        "address",
        "latitude",
        "longitude",
        "timezone",
        "notes",
    ];
    for (const f of fields) {
        if (patch[f] !== undefined) {
            sets.push(`${f} = $${n++}`);
            vals.push(patch[f]);
        }
    }
    if (patch.metadata !== undefined) {
        sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${n}::jsonb`);
        vals.push(JSON.stringify(patch.metadata));
        n++;
    }
    if (sets.length === 0) {
        if (expectedUpdatedAt) {
            const chk = await client.query(`SELECT * FROM venues WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL AND updated_at = $3::timestamptz`, [tenantId, id, expectedUpdatedAt]);
            return chk.rows[0] ? map(chk.rows[0]) : null;
        }
        return getVenueById(client, tenantId, id);
    }
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    let where = `tenant_id = $${n} AND id = $${n + 1} AND deleted_at IS NULL`;
    n += 2;
    if (expectedUpdatedAt) {
        where += ` AND updated_at = $${n}::timestamptz`;
        vals.push(expectedUpdatedAt);
    }
    const r = await client.query(`UPDATE venues SET ${sets.join(", ")} WHERE ${where} RETURNING *`, vals);
    return r.rows[0] ? map(r.rows[0]) : null;
}
export async function listVenues(client, tenantId, search, limit, cursorUpdatedAt, cursorId) {
    const vals = [tenantId];
    let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
    let i = 2;
    if (search?.trim()) {
        w += ` AND (name ILIKE $${i} OR city ILIKE $${i})`;
        vals.push(`%${search.trim()}%`);
        i++;
    }
    if (cursorUpdatedAt && cursorId) {
        w += ` AND (updated_at < $${i}::timestamptz OR (updated_at = $${i}::timestamptz AND id < $${i + 1}::uuid))`;
        vals.push(cursorUpdatedAt, cursorId);
        i += 2;
    }
    vals.push(limit);
    const r = await client.query(`SELECT * FROM venues ${w} ORDER BY updated_at DESC, id DESC LIMIT $${vals.length}`, vals);
    return r.rows.map(map);
}
export async function countVenues(client, tenantId, search) {
    const vals = [tenantId];
    let w = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
    if (search?.trim()) {
        w += ` AND (name ILIKE $2 OR city ILIKE $2)`;
        vals.push(`%${search.trim()}%`);
    }
    const r = await client.query(`SELECT count(*)::int AS c FROM venues ${w}`, vals);
    return r.rows[0]?.c ?? 0;
}
export async function softDeleteVenue(client, tenantId, id) {
    const r = await client.query(`UPDATE venues SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`, [tenantId, id]);
    if (!r.rows[0])
        return null;
    return {
        id: r.rows[0].id,
        deleted_at: r.rows[0].deleted_at.toISOString(),
    };
}
export async function countEventsForVenue(client, tenantId, venueId) {
    const r = await client.query(`SELECT count(*)::int AS c FROM events e
     WHERE e.tenant_id = $1 AND e.venue_id = $2 AND e.deleted_at IS NULL`, [tenantId, venueId]);
    return r.rows[0]?.c ?? 0;
}
