import type { Pool, PoolClient } from "pg";

export type AuditLogRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: unknown;
  correlation_id: string | null;
  ip_address: string | null;
  created_at: Date;
};

type Db = Pool | PoolClient;

export async function insertAuditLog(
  db: Db,
  row: {
    id: string;
    tenantId: string;
    userId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    changes: unknown;
    correlationId: string | null;
    ipAddress: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (
      id, tenant_id, user_id, entity_type, entity_id, action, changes, correlation_id, ip_address
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
    [
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
    ],
  );
}

export async function listAuditLogs(
  db: Db,
  params: {
    tenantId: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  },
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const cond: string[] = ["tenant_id = $1"];
  const vals: unknown[] = [params.tenantId];
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
  const cnt = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM audit_logs WHERE ${where}`,
    vals,
  );
  const total = Number(cnt.rows[0]?.c ?? 0);
  vals.push(params.limit, params.offset);
  const lim = n;
  const off = n + 1;
  const r = await db.query<AuditLogRow>(
    `SELECT id, tenant_id, user_id, entity_type, entity_id, action, changes, correlation_id, ip_address, created_at
     FROM audit_logs WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${lim} OFFSET $${off}`,
    vals,
  );
  return { rows: r.rows, total };
}
