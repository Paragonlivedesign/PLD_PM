import { emailsFromSingle, parseEmailsJson, parsePhonesJson, phonesFromSingle, primaryEmailNormalizedFromEmails, } from "./person-utils.js";
function mapPerson(r) {
    const emails = parseEmailsJson(r.emails);
    const phones = parsePhonesJson(r.phones);
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    return {
        id: r.id,
        tenant_id: r.tenant_id,
        display_name: r.display_name,
        emails,
        phones,
        primary_email_normalized: r.primary_email_normalized,
        personnel_id: r.personnel_id,
        user_id: r.user_id,
        metadata,
        created_by_user_id: r.created_by_user_id,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
        deleted_at: r.deleted_at ? r.deleted_at.toISOString() : null,
    };
}
export async function insertContactPerson(client, p) {
    const emails = emailsFromSingle(p.email);
    const phones = phonesFromSingle(p.phone);
    const primaryNorm = primaryEmailNormalizedFromEmails(emails);
    const meta = p.metadata ?? {};
    const r = await client.query(`INSERT INTO contact_persons (
      id, tenant_id, display_name, emails, phones, primary_email_normalized,
      personnel_id, metadata, created_by_user_id, created_at, updated_at
    ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb,$9,NOW(),NOW())
    RETURNING *`, [
        p.id,
        p.tenantId,
        p.displayName,
        JSON.stringify(emails),
        JSON.stringify(phones),
        primaryNorm,
        p.personnelId,
        JSON.stringify(meta),
        p.createdByUserId ?? null,
    ]);
    return mapPerson(r.rows[0]);
}
export async function getContactPersonById(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM contact_persons
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ? mapPerson(r.rows[0]) : null;
}
export async function syncPersonFromContactFields(client, tenantId, personId, displayName, email, phone, personnelId) {
    const emails = emailsFromSingle(email);
    const phones = phonesFromSingle(phone);
    const primaryNorm = primaryEmailNormalizedFromEmails(emails);
    await client.query(`UPDATE contact_persons SET
      display_name = $3,
      emails = $4::jsonb,
      phones = $5::jsonb,
      primary_email_normalized = $6,
      personnel_id = COALESCE($7, personnel_id),
      updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [
        tenantId,
        personId,
        displayName,
        JSON.stringify(emails),
        JSON.stringify(phones),
        primaryNorm,
        personnelId,
    ]);
}
export async function listContactPersonsForHub(client, tenantId, opts) {
    const limit = Math.min(Math.max(opts.limit, 1), 200);
    const search = opts.search?.trim() || "";
    const params = [tenantId];
    let p = 2;
    let searchSql = "";
    if (search) {
        const like = `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
        searchSql = ` AND (
      cp.display_name ILIKE $${p} OR
      cp.primary_email_normalized ILIKE $${p} OR
      EXISTS (
        SELECT 1 FROM jsonb_array_elements(cp.emails) e
        WHERE e->>'address' ILIKE $${p}
      )
    )`;
        params.push(like);
        p++;
    }
    let parentSql = "";
    if (opts.parentType && opts.parentId) {
        parentSql = ` AND EXISTS (
      SELECT 1 FROM contacts co2
      WHERE co2.person_id = cp.id AND co2.deleted_at IS NULL
        AND co2.parent_type = $${p} AND co2.parent_id = $${p + 1}::uuid
    )`;
        params.push(opts.parentType, opts.parentId);
        p += 2;
    }
    params.push(limit);
    const limIdx = p;
    const r = await client.query(`WITH ids AS (
      SELECT DISTINCT cp.id
      FROM contact_persons cp
      INNER JOIN contacts co ON co.person_id = cp.id AND co.deleted_at IS NULL
      WHERE cp.tenant_id = $1 AND cp.deleted_at IS NULL
      ${searchSql}
      ${parentSql}
    ),
    ranked AS (
      SELECT cp.id, cp.display_name
      FROM contact_persons cp
      INNER JOIN ids ON ids.id = cp.id
      ORDER BY cp.display_name ASC, cp.id ASC
      LIMIT $${limIdx}
    )
    SELECT
      cp.id,
      cp.tenant_id,
      cp.display_name,
      cp.emails,
      cp.phones,
      cp.primary_email_normalized,
      cp.personnel_id,
      cp.user_id,
      cp.metadata,
      cp.created_by_user_id,
      cp.created_at,
      cp.updated_at,
      cp.deleted_at,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'membership_id', co.id,
              'parent_type', co.parent_type,
              'parent_id', co.parent_id,
              'title', co.title,
              'is_primary', co.is_primary
            ) ORDER BY co.is_primary DESC, co.name
          )
          FROM contacts co
          WHERE co.person_id = cp.id AND co.deleted_at IS NULL
        ),
        '[]'::json
      ) AS memberships
    FROM contact_persons cp
    INNER JOIN ranked r ON r.id = cp.id
    ORDER BY cp.display_name ASC`, params);
    return r.rows.map((row) => {
        const raw = row.memberships;
        const arr = Array.isArray(raw) ? raw : [];
        const memberships = arr.map((x) => {
            const o = x;
            return {
                membership_id: String(o.membership_id ?? ""),
                parent_type: o.parent_type,
                parent_id: String(o.parent_id ?? ""),
                title: o.title != null ? String(o.title) : null,
                is_primary: Boolean(o.is_primary),
            };
        });
        const { memberships: _m, ...rest } = row;
        return { ...mapPerson(rest), memberships };
    });
}
