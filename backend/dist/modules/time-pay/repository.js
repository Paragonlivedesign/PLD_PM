function iso(d) {
    return d.toISOString();
}
export function mapTimeEntry(r) {
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    return {
        id: r.id,
        personnel_id: r.personnel_id,
        event_id: r.event_id,
        crew_assignment_id: r.crew_assignment_id,
        started_at: iso(r.started_at),
        ended_at: r.ended_at ? iso(r.ended_at) : null,
        status: r.status,
        notes: r.notes,
        metadata,
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
    };
}
export async function findOpenTimeEntry(client, tenantId, personnelId) {
    const r = await client.query(`SELECT * FROM time_entries
     WHERE tenant_id = $1 AND personnel_id = $2 AND deleted_at IS NULL
       AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`, [tenantId, personnelId]);
    return r.rows[0] ?? null;
}
export async function insertTimeEntry(client, p) {
    const r = await client.query(`INSERT INTO time_entries (
      id, tenant_id, personnel_id, event_id, crew_assignment_id,
      started_at, ended_at, status, notes, metadata
    ) VALUES ($1,$2,$3,$4,$5,NOW(),NULL,'open',$6,$7::jsonb)
    RETURNING *`, [
        p.id,
        p.tenantId,
        p.personnelId,
        p.eventId,
        p.crewAssignmentId,
        p.notes,
        JSON.stringify(p.metadata),
    ]);
    return mapTimeEntry(r.rows[0]);
}
export async function closeTimeEntry(client, tenantId, personnelId, id) {
    const r = await client.query(`UPDATE time_entries
     SET ended_at = NOW(), status = 'closed', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND personnel_id = $3
       AND deleted_at IS NULL AND ended_at IS NULL
     RETURNING *`, [id, tenantId, personnelId]);
    return r.rows[0] ? mapTimeEntry(r.rows[0]) : null;
}
export async function listTimeEntries(client, tenantId, personnelId, limit) {
    const vals = [tenantId];
    let where = `WHERE tenant_id = $1 AND deleted_at IS NULL`;
    if (personnelId) {
        vals.push(personnelId);
        where += ` AND personnel_id = $2`;
    }
    vals.push(limit);
    const r = await client.query(`SELECT * FROM time_entries ${where}
     ORDER BY started_at DESC
     LIMIT $${vals.length}`, vals);
    return r.rows.map(mapTimeEntry);
}
function isoDate(d) {
    if (d instanceof Date)
        return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}
export function mapPayPeriod(r) {
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    return {
        id: r.id,
        period_start: isoDate(r.period_start),
        period_end: isoDate(r.period_end),
        pay_date: r.pay_date ? isoDate(r.pay_date) : null,
        status: r.status,
        metadata,
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
    };
}
export async function insertPayPeriod(client, p) {
    const r = await client.query(`INSERT INTO pay_periods (id, tenant_id, period_start, period_end, pay_date, status, metadata)
     VALUES ($1,$2,$3::date,$4::date,$5::date,'draft',$6::jsonb)
     RETURNING *`, [
        p.id,
        p.tenantId,
        p.periodStart,
        p.periodEnd,
        p.payDate,
        JSON.stringify(p.metadata),
    ]);
    return mapPayPeriod(r.rows[0]);
}
export async function listPayPeriods(client, tenantId, limit) {
    const r = await client.query(`SELECT * FROM pay_periods
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY period_start DESC
     LIMIT $2`, [tenantId, limit]);
    return r.rows.map(mapPayPeriod);
}
export async function countPayStatementsForPeriod(client, tenantId, payPeriodId) {
    const r = await client.query(`SELECT count(*)::int AS c FROM pay_statements
     WHERE tenant_id = $1 AND pay_period_id = $2 AND deleted_at IS NULL`, [tenantId, payPeriodId]);
    return r.rows[0]?.c ?? 0;
}
