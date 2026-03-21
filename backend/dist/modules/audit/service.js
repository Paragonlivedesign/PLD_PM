import { randomUUID } from "node:crypto";
import * as repo from "./repository.js";
export async function writeAuditLog(pool, input) {
    await repo.insertAuditLog(pool, {
        id: randomUUID(),
        tenantId: input.tenantId,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes,
        correlationId: input.correlationId ?? null,
        ipAddress: input.ipAddress ?? null,
    });
}
function isPgUndefinedTable(e) {
    return (typeof e === "object" &&
        e !== null &&
        "code" in e &&
        e.code === "42P01");
}
export async function listAuditLogsApi(pool, tenantId, q) {
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? 25) || 25));
    const offset = Math.max(0, Number(q.offset ?? 0) || 0);
    let rows;
    let total;
    try {
        const out = await repo.listAuditLogs(pool, {
            tenantId,
            entityType: q.entity_type,
            entityId: q.entity_id,
            userId: q.user_id,
            from: q.from,
            to: q.to,
            limit,
            offset,
        });
        rows = out.rows;
        total = out.total;
    }
    catch (e) {
        /** e.g. DB migrated with baseline that skipped 006_audit_logs.sql — avoid 500 until `npm run db:migrate` repair */
        if (isPgUndefinedTable(e)) {
            return {
                data: [],
                meta: { total_count: 0, limit, offset },
            };
        }
        throw e;
    }
    const data = rows.map((r) => ({
        id: r.id,
        tenant_id: r.tenant_id,
        user_id: r.user_id,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        action: r.action,
        changes: r.changes,
        correlation_id: r.correlation_id,
        ip_address: r.ip_address,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
    return {
        data,
        meta: { total_count: total, limit, offset },
    };
}
