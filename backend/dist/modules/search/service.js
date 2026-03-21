import { randomUUID } from "node:crypto";
const ENTITY_TYPES = [
    "events",
    "personnel",
    "trucks",
    "venues",
    "clients",
    "documents",
];
function sanitizeQuery(q) {
    return q.trim().slice(0, 200);
}
export async function countSearchIndexRows(pool, tenantId) {
    const { rows } = await pool.query(`SELECT COUNT(*)::text AS c FROM search_index WHERE tenant_id = $1 AND deleted_at IS NULL`, [tenantId]);
    return Number(rows[0]?.c ?? 0);
}
/** Full rebuild of search rows for a tenant from source tables (MVP bootstrap). */
export async function syncSearchIndexForTenant(pool, tenantId) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM search_index WHERE tenant_id = $1`, [tenantId]);
        await client.query(`
      INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at)
      SELECT e.tenant_id, 'events', e.id, e.name, c.name, COALESCE(e.description, ''),
        jsonb_build_object('status', e.status, 'start_date', e.start_date::text, 'phase', e.phase),
        e.updated_at
      FROM events e
      JOIN clients c ON c.id = e.client_id AND c.tenant_id = e.tenant_id
      WHERE e.tenant_id = $1 AND e.deleted_at IS NULL
      `, [tenantId]);
        await client.query(`
      INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at)
      SELECT p.tenant_id, 'personnel', p.id,
        trim(p.first_name || ' ' || p.last_name), p.email, COALESCE(p.role, ''),
        jsonb_build_object('status', p.status, 'email', p.email),
        p.updated_at
      FROM personnel p
      WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
      `, [tenantId]);
        await client.query(`
      INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at)
      SELECT tenant_id, 'clients', id, name, NULL, COALESCE(notes, ''),
        jsonb_build_object(),
        updated_at
      FROM clients
      WHERE tenant_id = $1 AND deleted_at IS NULL
      `, [tenantId]);
        await client.query(`
      INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at)
      SELECT tenant_id, 'venues', id, name, city, COALESCE(address, ''),
        jsonb_build_object('city', city),
        updated_at
      FROM venues
      WHERE tenant_id = $1 AND deleted_at IS NULL
      `, [tenantId]);
        await client.query(`
      INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at)
      SELECT tenant_id, 'trucks', id, name, type, COALESCE(notes, ''),
        jsonb_build_object('status', status, 'type', type),
        updated_at
      FROM trucks
      WHERE tenant_id = $1 AND deleted_at IS NULL
      `, [tenantId]);
        await client.query(`
      INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at)
      SELECT tenant_id, 'documents', id, name, category, COALESCE(description, ''),
        jsonb_build_object('category', category, 'mime_type', mime_type),
        updated_at
      FROM documents
      WHERE tenant_id = $1 AND deleted_at IS NULL
      `, [tenantId]);
        await client.query("COMMIT");
    }
    catch (e) {
        await client.query("ROLLBACK");
        throw e;
    }
    finally {
        client.release();
    }
}
export async function searchUnified(pool, args) {
    const t0 = Date.now();
    const q = sanitizeQuery(args.q);
    if (q.length === 0) {
        return { results: {}, total_counts: {}, query_time_ms: Date.now() - t0 };
    }
    let count = await countSearchIndexRows(pool, args.tenantId);
    if (count === 0) {
        await syncSearchIndexForTenant(pool, args.tenantId);
        count = await countSearchIndexRows(pool, args.tenantId);
    }
    const typeFilter = args.types && args.types.length > 0
        ? args.types.filter((t) => ENTITY_TYPES.includes(t))
        : [...ENTITY_TYPES];
    const tsQuery = q.replace(/[^\w\s]/g, " ").trim();
    if (tsQuery.length === 0) {
        return { results: {}, total_counts: {}, query_time_ms: Date.now() - t0 };
    }
    const results = {};
    const total_counts = {};
    for (const et of typeFilter) {
        const { rows: countRows } = await pool.query(`
      SELECT COUNT(*)::text AS c
      FROM search_index
      WHERE tenant_id = $1 AND entity_type = $2 AND deleted_at IS NULL
        AND search_vector @@ plainto_tsquery('english', $3)
      `, [args.tenantId, et, tsQuery]);
        total_counts[et] = Number(countRows[0]?.c ?? 0);
        const { rows } = await pool.query(`
      SELECT entity_id, entity_type, title, subtitle, metadata,
        ts_rank_cd(search_vector, plainto_tsquery('english', $3))::text AS rank,
        entity_updated_at
      FROM search_index
      WHERE tenant_id = $1 AND entity_type = $2 AND deleted_at IS NULL
        AND search_vector @@ plainto_tsquery('english', $3)
      ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', $3)) DESC, entity_updated_at DESC
      LIMIT $4
      `, [args.tenantId, et, tsQuery, args.limitPerType]);
        results[et] = rows.map((row) => {
            const rank = Number(row.rank);
            const ageMs = Date.now() - new Date(row.entity_updated_at).getTime();
            const ageDays = ageMs / 86400000;
            const recency = 1 / (1 + ageDays / 30);
            const relevance_score = Math.min(1, Math.max(0.05, rank * 0.8 + recency * 0.15));
            return {
                entity_id: row.entity_id,
                entity_type: row.entity_type,
                title: row.title,
                subtitle: row.subtitle,
                metadata: row.metadata ?? {},
                relevance_score: Math.round(relevance_score * 1000) / 1000,
            };
        });
    }
    return {
        results,
        total_counts,
        query_time_ms: Date.now() - t0,
    };
}
export async function indexEntity(pool, entity_type, entity_id, tenant_id, data) {
    const sf = data.search_fields;
    const body = [
        ...(sf?.weight_a ?? []),
        ...(sf?.weight_b ?? []),
        ...(sf?.weight_c ?? []),
        ...(sf?.weight_d ?? []),
    ].join(" ") || "";
    await pool.query(`
    INSERT INTO search_index (tenant_id, entity_type, entity_id, title, subtitle, body_text, metadata, entity_updated_at, deleted_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, NULL)
    ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET
      title = EXCLUDED.title,
      subtitle = EXCLUDED.subtitle,
      body_text = EXCLUDED.body_text,
      metadata = EXCLUDED.metadata,
      entity_updated_at = EXCLUDED.entity_updated_at,
      deleted_at = NULL,
      updated_at = NOW()
    `, [
        tenant_id,
        entity_type,
        entity_id,
        data.title,
        data.subtitle ?? null,
        body,
        data.metadata ?? {},
        data.entity_updated_at,
    ]);
    return { indexed: true };
}
export async function removeFromIndex(pool, entity_type, entity_id, tenant_id) {
    const r = await pool.query(`UPDATE search_index SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL`, [tenant_id, entity_type, entity_id]);
    return { removed: r.rowCount != null && r.rowCount > 0 };
}
export async function reindexAll(pool, tenant_id, _entity_type, _options) {
    await syncSearchIndexForTenant(pool, tenant_id);
    const { rows } = await pool.query(`SELECT COUNT(*)::text AS c FROM search_index WHERE tenant_id = $1 AND deleted_at IS NULL`, [tenant_id]);
    return {
        job_id: randomUUID(),
        status: "queued",
        estimated_entities: Number(rows[0]?.c ?? 0),
    };
}
