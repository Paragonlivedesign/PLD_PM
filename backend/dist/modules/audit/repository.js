export async function insertAuditLog(db, row) {
    await db.query(`INSERT INTO audit_logs (
      id, tenant_id, user_id, entity_type, entity_id, action, changes, correlation_id, ip_address
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`, [
        row.id,
        row.tenantId,
        row.userId,
        row.entityType,
        row.entityId,
        row.action,
        row.changes === undefined || row.changes === null
            ? null
            : JSON.stringify(row.changes),
        row.correlationId,
        row.ipAddress,
    ]);
}
export async function listAuditLogs(db, params) {
    const cond = ["tenant_id = $1"];
    const vals = [params.tenantId];
    let n = 2;
    if (params.entityType) {
        cond.push(`entity_type = $${n}`);
        vals.push(params.entityType);
        n++;
    }
    if (params.entityId) {
        cond.push(`entity_id = $${n}`);
        vals.push(params.entityId);
        n++;
    }
    if (params.userId) {
        cond.push(`user_id = $${n}`);
        vals.push(params.userId);
        n++;
    }
    if (params.from) {
        cond.push(`created_at >= $${n}::timestamptz`);
        vals.push(params.from);
        n++;
    }
    if (params.to) {
        cond.push(`created_at <= $${n}::timestamptz`);
        vals.push(params.to);
        n++;
    }
    const where = cond.join(" AND ");
    const cnt = await db.query(`SELECT count(*)::text AS c FROM audit_logs WHERE ${where}`, vals);
    const total = Number(cnt.rows[0]?.c ?? 0);
    vals.push(params.limit, params.offset);
    const lim = n;
    const off = n + 1;
    const r = await db.query(`SELECT id, tenant_id, user_id, entity_type, entity_id, action, changes, correlation_id, ip_address, created_at
     FROM audit_logs WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${lim} OFFSET $${off}`, vals);
    return { rows: r.rows, total };
}
