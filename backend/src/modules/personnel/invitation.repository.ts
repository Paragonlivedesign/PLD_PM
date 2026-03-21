import { createHash, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { InvitationResponse } from "./personnel.types.js";

export type Db = Pool | PoolClient;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

function mapInvitationRow(r: Record<string, unknown>): InvitationResponse {
  return {
    id: String(r.id),
    email: String(r.email),
    first_name: String(r.first_name),
    last_name: String(r.last_name),
    role: String(r.role),
    department_id: r.department_id ? String(r.department_id) : null,
    status: r.status as InvitationResponse["status"],
    invited_by: String(r.invited_by),
    expires_at: new Date(String(r.expires_at)).toISOString(),
    accepted_at: r.accepted_at ? new Date(String(r.accepted_at)).toISOString() : null,
    created_at: new Date(String(r.created_at)).toISOString(),
  };
}

function displayStatus(
  row: Record<string, unknown>,
): InvitationResponse["status"] {
  const s = String(row.status);
  const expiresAt = new Date(String(row.expires_at));
  if (s === "pending" && expiresAt < new Date()) return "expired";
  return s as InvitationResponse["status"];
}

export async function insertInvitation(
  db: Db,
  row: {
    id: string;
    tenant_id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    department_id: string | null;
    employment_type: string | null;
    message: string | null;
    token_hash: string;
    expires_at: Date;
    invited_by: string;
  },
): Promise<InvitationResponse> {
  const q = `
    INSERT INTO personnel_invitations (
      id, tenant_id, email, first_name, last_name, role, department_id,
      employment_type, message, status, token_hash, expires_at, invited_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12)
    RETURNING *
  `;
  const res = await db.query(q, [
    row.id,
    row.tenant_id,
    row.email.toLowerCase(),
    row.first_name,
    row.last_name,
    row.role,
    row.department_id,
    row.employment_type,
    row.message,
    row.token_hash,
    row.expires_at,
    row.invited_by,
  ]);
  const raw = res.rows[0] as Record<string, unknown>;
  return { ...mapInvitationRow(raw), status: displayStatus(raw) };
}

export async function findInvitationByTokenHash(
  db: Db,
  tokenHash: string,
): Promise<(Record<string, unknown> & { tenant_id: string }) | null> {
  const q = `SELECT * FROM personnel_invitations WHERE token_hash = $1`;
  const res = await db.query(q, [tokenHash]);
  if (res.rows.length === 0) return null;
  return res.rows[0] as Record<string, unknown> & { tenant_id: string };
}

export async function revokeInvitation(
  db: Db,
  tenantId: string,
  id: string,
): Promise<{ id: string; revoked_at: string } | null> {
  const q = `
    UPDATE personnel_invitations
    SET status = 'revoked', revoked_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
    RETURNING id, revoked_at
  `;
  const res = await db.query(q, [tenantId, id]);
  if (res.rows.length === 0) return null;
  return {
    id: String(res.rows[0].id),
    revoked_at: new Date(String(res.rows[0].revoked_at)).toISOString(),
  };
}

export async function acceptInvitation(
  db: Db,
  invitationId: string,
): Promise<void> {
  await db.query(
    `UPDATE personnel_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
    [invitationId],
  );
}

export async function listInvitations(
  db: Db,
  tenantId: string,
  statusFilter: InvitationResponse["status"] | undefined,
  offset: number,
  limit: number,
): Promise<InvitationResponse[]> {
  const vals: unknown[] = [tenantId];
  let where = "WHERE tenant_id = $1";
  let n = 2;
  if (statusFilter) {
    if (statusFilter === "expired") {
      where += ` AND status = 'pending' AND expires_at < NOW()`;
    } else if (statusFilter === "pending") {
      where += ` AND status = 'pending' AND expires_at >= NOW()`;
    } else {
      where += ` AND status = $${n}`;
      vals.push(statusFilter);
      n++;
    }
  }
  vals.push(limit, offset);
  const q = `
    SELECT * FROM personnel_invitations
    ${where}
    ORDER BY created_at DESC
    LIMIT $${n} OFFSET $${n + 1}
  `;
  const res = await db.query(q, vals);
  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { ...mapInvitationRow(r), status: displayStatus(r) };
  });
}

export async function countInvitations(
  db: Db,
  tenantId: string,
  statusFilter: InvitationResponse["status"] | undefined,
): Promise<number> {
  const vals: unknown[] = [tenantId];
  let where = "WHERE tenant_id = $1";
  if (statusFilter) {
    if (statusFilter === "expired") {
      where += ` AND status = 'pending' AND expires_at < NOW()`;
    } else if (statusFilter === "pending") {
      where += ` AND status = 'pending' AND expires_at >= NOW()`;
    } else {
      vals.push(statusFilter);
      where += ` AND status = $${vals.length}`;
    }
  }
  const res = await db.query(`SELECT COUNT(*)::int AS c FROM personnel_invitations ${where}`, vals);
  return Number(res.rows[0].c);
}
