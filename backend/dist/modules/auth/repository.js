export async function findRoleIdByTenantAndName(pool, tenantId, roleName) {
    const r = await pool.query(`SELECT id FROM roles
     WHERE tenant_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL
     LIMIT 1`, [tenantId, roleName]);
    return r.rows[0]?.id ?? null;
}
export async function findTenantBySlug(pool, slug) {
    const r = await pool.query(`SELECT id, status FROM tenants WHERE lower(slug) = lower($1) LIMIT 1`, [slug]);
    const row = r.rows[0];
    if (!row)
        return null;
    return { id: row.id, is_active: row.status === "active" };
}
export async function findUserByEmail(pool, tenantId, email) {
    const r = await pool.query(`SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role_id, r.name AS role_name,
            u.personnel_id, u.first_name, u.last_name, u.phone, u.preferences,
            u.is_active, u.failed_login_attempts, u.locked_until, u.last_login_at,
            u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL
     WHERE u.tenant_id = $1 AND lower(u.email) = lower($2) AND u.deleted_at IS NULL
     LIMIT 1`, [tenantId, email]);
    const row = r.rows[0];
    if (!row)
        return null;
    return {
        ...row,
        preferences: typeof row.preferences === "object" && row.preferences !== null
            ? row.preferences
            : {},
    };
}
export async function findUserByIdAnyTenant(pool, userId) {
    const r = await pool.query(`SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role_id, r.name AS role_name,
            u.personnel_id, u.first_name, u.last_name, u.phone, u.preferences,
            u.is_active, u.failed_login_attempts, u.locked_until, u.last_login_at,
            u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL
     WHERE u.id = $1 AND u.deleted_at IS NULL
     LIMIT 1`, [userId]);
    const row = r.rows[0];
    if (!row)
        return null;
    return {
        ...row,
        preferences: typeof row.preferences === "object" && row.preferences !== null
            ? row.preferences
            : {},
    };
}
export async function findUserById(pool, tenantId, userId) {
    const r = await pool.query(`SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role_id, r.name AS role_name,
            u.personnel_id, u.first_name, u.last_name, u.phone, u.preferences,
            u.is_active, u.failed_login_attempts, u.locked_until, u.last_login_at,
            u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.deleted_at IS NULL
     WHERE u.tenant_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
     LIMIT 1`, [tenantId, userId]);
    const row = r.rows[0];
    if (!row)
        return null;
    return {
        ...row,
        preferences: typeof row.preferences === "object" && row.preferences !== null
            ? row.preferences
            : {},
    };
}
export async function listPermissionsForRole(pool, roleId) {
    const r = await pool.query(`SELECT permission FROM role_permissions WHERE role_id = $1`, [roleId]);
    return r.rows.map((x) => x.permission);
}
export async function incrementFailedLogin(pool, userId) {
    await pool.query(`UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW() WHERE id = $1`, [userId]);
}
export async function lockUser(pool, userId, until) {
    await pool.query(`UPDATE users SET locked_until = $2, updated_at = NOW() WHERE id = $1`, [userId, until]);
}
export async function resetLoginSuccess(pool, userId) {
    await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW()
     WHERE id = $1`, [userId]);
}
export async function insertRefreshToken(pool, id, tenantId, userId, tokenHash, familyId, expiresAt) {
    await pool.query(`INSERT INTO refresh_tokens (id, tenant_id, user_id, token_hash, family_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`, [id, tenantId, userId, tokenHash, familyId, expiresAt]);
}
export async function findRefreshByHash(pool, tokenHash) {
    const r = await pool.query(`SELECT id, tenant_id, user_id, token_hash, family_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`, [tokenHash]);
    return r.rows[0] ?? null;
}
export async function revokeRefreshToken(pool, id) {
    await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [id]);
}
export async function revokeRefreshFamily(pool, familyId) {
    await pool.query(`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1`, [familyId]);
}
export async function revokeAllUserRefreshTokens(pool, userId) {
    await pool.query(`UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}
export async function findRoleByName(pool, tenantId, name) {
    const r = await pool.query(`SELECT id FROM roles WHERE tenant_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL LIMIT 1`, [tenantId, name]);
    return r.rows[0] ?? null;
}
export async function findUserIdByPersonnel(pool, tenantId, personnelId) {
    const r = await pool.query(`SELECT id FROM users WHERE tenant_id = $1 AND personnel_id = $2 AND deleted_at IS NULL LIMIT 1`, [tenantId, personnelId]);
    return r.rows[0]?.id ?? null;
}
export async function insertPasswordResetToken(pool, id, userId, tokenHash, expiresAt) {
    await pool.query(`INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`, [id, userId, tokenHash, expiresAt]);
}
export async function findPasswordResetByHash(pool, tokenHash) {
    const r = await pool.query(`SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1`, [tokenHash]);
    return r.rows[0] ?? null;
}
export async function markPasswordResetUsed(pool, id) {
    await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [id]);
}
export async function updateUserPassword(pool, userId, passwordHash) {
    await pool.query(`UPDATE users SET password_hash = $2, updated_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [userId, passwordHash]);
}
export async function updateUserProfile(pool, userId, tenantId, patch) {
    const sets = [];
    const vals = [];
    let i = 1;
    if (patch.first_name !== undefined) {
        sets.push(`first_name = $${i++}`);
        vals.push(patch.first_name);
    }
    if (patch.last_name !== undefined) {
        sets.push(`last_name = $${i++}`);
        vals.push(patch.last_name);
    }
    if (patch.email !== undefined) {
        sets.push(`email = $${i++}`);
        vals.push(patch.email);
    }
    if (patch.phone !== undefined) {
        sets.push(`phone = $${i++}`);
        vals.push(patch.phone);
    }
    if (patch.preferences !== undefined) {
        sets.push(`preferences = $${i++}::jsonb`);
        vals.push(JSON.stringify(patch.preferences));
    }
    if (sets.length === 0) {
        return findUserById(pool, tenantId, userId);
    }
    sets.push(`updated_at = NOW()`);
    vals.push(userId, tenantId);
    const q = `UPDATE users SET ${sets.join(", ")} WHERE id = $${i++} AND tenant_id = $${i} AND deleted_at IS NULL RETURNING id`;
    const r = await pool.query(q, vals);
    if (r.rowCount === 0)
        return null;
    return findUserById(pool, tenantId, userId);
}
export async function emailTakenByOtherUser(pool, tenantId, email, excludeUserId) {
    const r = await pool.query(`SELECT 1 FROM users WHERE tenant_id = $1 AND lower(email) = lower($2) AND id <> $3 AND deleted_at IS NULL LIMIT 1`, [tenantId, email, excludeUserId]);
    return r.rowCount !== null && r.rowCount > 0;
}
export async function insertUser(pool, params) {
    await pool.query(`INSERT INTO users (id, tenant_id, email, password_hash, role_id, personnel_id, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        params.id,
        params.tenantId,
        params.email,
        params.passwordHash,
        params.roleId,
        params.personnelId,
        params.firstName,
        params.lastName,
    ]);
}
export async function insertAuthInvitation(pool, params) {
    await pool.query(`INSERT INTO auth_invitations (id, tenant_id, email, role_id, invited_by, personnel_id, token_hash, expires_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`, [
        params.id,
        params.tenantId,
        params.email,
        params.roleId,
        params.invitedBy,
        params.personnelId,
        params.tokenHash,
        params.expiresAt,
    ]);
}
export async function findPendingInvitationByEmail(pool, tenantId, email) {
    const r = await pool.query(`SELECT id FROM auth_invitations
     WHERE tenant_id = $1 AND lower(email) = lower($2) AND status = 'pending'
       AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`, [tenantId, email]);
    return r.rows[0] ?? null;
}
export async function findAuthInvitationByTokenHash(pool, tokenHash) {
    const r = await pool.query(`SELECT id, tenant_id, email, role_id, personnel_id, expires_at, status
     FROM auth_invitations WHERE token_hash = $1 LIMIT 1`, [tokenHash]);
    return r.rows[0] ?? null;
}
export async function markInvitationAccepted(pool, id) {
    await pool.query(`UPDATE auth_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [id]);
}
