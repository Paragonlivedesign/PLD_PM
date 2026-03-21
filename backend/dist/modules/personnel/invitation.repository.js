import { createHash, randomBytes } from "node:crypto";
export function hashInvitationToken(token) {
    return createHash("sha256").update(token, "utf8").digest("hex");
}
export function generateInvitationToken() {
    return randomBytes(32).toString("base64url");
}
function mapInvitationRow(r) {
    return {
        id: String(r.id),
        email: String(r.email),
        first_name: String(r.first_name),
        last_name: String(r.last_name),
        role: String(r.role),
        department_id: r.department_id ? String(r.department_id) : null,
        status: r.status,
        invited_by: String(r.invited_by),
        expires_at: new Date(String(r.expires_at)).toISOString(),
        accepted_at: r.accepted_at ? new Date(String(r.accepted_at)).toISOString() : null,
        created_at: new Date(String(r.created_at)).toISOString(),
    };
}
function displayStatus(row) {
    const s = String(row.status);
    const expiresAt = new Date(String(row.expires_at));
    if (s === "pending" && expiresAt < new Date())
        return "expired";
    return s;
}
export async function insertInvitation(db, row) {
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
    const raw = res.rows[0];
    return { ...mapInvitationRow(raw), status: displayStatus(raw) };
}
export async function findInvitationByTokenHash(db, tokenHash) {
    const q = `SELECT * FROM personnel_invitations WHERE token_hash = $1`;
    const res = await db.query(q, [tokenHash]);
    if (res.rows.length === 0)
        return null;
    return res.rows[0];
}
export async function revokeInvitation(db, tenantId, id) {
    const q = `
    UPDATE personnel_invitations
    SET status = 'revoked', revoked_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
    RETURNING id, revoked_at
  `;
    const res = await db.query(q, [tenantId, id]);
    if (res.rows.length === 0)
        return null;
    return {
        id: String(res.rows[0].id),
        revoked_at: new Date(String(res.rows[0].revoked_at)).toISOString(),
    };
}
export async function acceptInvitation(db, invitationId) {
    await db.query(`UPDATE personnel_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [invitationId]);
}
export async function listInvitations(db, tenantId, statusFilter, offset, limit) {
    const vals = [tenantId];
    let where = "WHERE tenant_id = $1";
    let n = 2;
    if (statusFilter) {
        if (statusFilter === "expired") {
            where += ` AND status = 'pending' AND expires_at < NOW()`;
        }
        else if (statusFilter === "pending") {
            where += ` AND status = 'pending' AND expires_at >= NOW()`;
        }
        else {
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
        const r = row;
        return { ...mapInvitationRow(r), status: displayStatus(r) };
    });
}
export async function countInvitations(db, tenantId, statusFilter) {
    const vals = [tenantId];
    let where = "WHERE tenant_id = $1";
    if (statusFilter) {
        if (statusFilter === "expired") {
            where += ` AND status = 'pending' AND expires_at < NOW()`;
        }
        else if (statusFilter === "pending") {
            where += ` AND status = 'pending' AND expires_at >= NOW()`;
        }
        else {
            vals.push(statusFilter);
            where += ` AND status = $${vals.length}`;
        }
    }
    const res = await db.query(`SELECT COUNT(*)::int AS c FROM personnel_invitations ${where}`, vals);
    return Number(res.rows[0].c);
}
