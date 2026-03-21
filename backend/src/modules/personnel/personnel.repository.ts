import type { Pool, PoolClient } from "pg";
import type {
  EmploymentType,
  PersonnelResponse,
  PersonnelRowInternal,
  PersonnelStatus,
} from "./personnel.types.js";

export type Db = Pool | PoolClient;

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number.parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

export function mapPersonnelRow(r: Record<string, unknown>): PersonnelRowInternal {
  return {
    id: String(r.id),
    first_name: String(r.first_name),
    last_name: String(r.last_name),
    email: String(r.email),
    phone: r.phone === null || r.phone === undefined ? null : String(r.phone),
    department_id: r.department_id ? String(r.department_id) : null,
    department_name: r.department_name ? String(r.department_name) : null,
    role: String(r.role),
    employment_type: r.employment_type as EmploymentType,
    day_rate: num(r.day_rate_amount as string | null),
    per_diem: num(r.per_diem_amount as string | null),
    skills: Array.isArray(r.skills) ? (r.skills as string[]) : [],
    status: r.status as PersonnelStatus,
    emergency_contact: r.emergency_contact
      ? (r.emergency_contact as PersonnelResponse["emergency_contact"])
      : null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    custom_fields:
      r.custom_fields && typeof r.custom_fields === "object" && !Array.isArray(r.custom_fields)
        ? (r.custom_fields as Record<string, unknown>)
        : {},
    created_at: new Date(String(r.created_at)).toISOString(),
    updated_at: new Date(String(r.updated_at)).toISOString(),
    deactivated_at: r.deactivated_at ? new Date(String(r.deactivated_at)).toISOString() : null,
    version: Number(r.version),
    photo_document_id:
      r.photo_document_id != null && String(r.photo_document_id) !== ""
        ? String(r.photo_document_id)
        : null,
    photo_url: null,
    photo_url_expires_at: null,
  };
}

export async function insertPersonnel(
  db: Db,
  row: {
    id: string;
    tenant_id: string;
    user_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    department_id: string | null;
    role: string;
    employment_type: string;
    skills: string[];
    day_rate_amount: number | null;
    day_rate_currency: string;
    per_diem_amount: number | null;
    per_diem_currency: string;
    status: string;
    emergency_contact: unknown | null;
    metadata: Record<string, unknown>;
    custom_fields?: Record<string, unknown>;
    photo_document_id?: string | null;
  },
): Promise<PersonnelRowInternal> {
  const q = `
    INSERT INTO personnel (
      id, tenant_id, user_id, first_name, last_name, email, phone, department_id,
      role, employment_type, skills, day_rate_amount, day_rate_currency,
      per_diem_amount, per_diem_currency, status, emergency_contact, metadata, custom_fields,
      photo_document_id
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,$20
    )
    RETURNING id
  `;
  await db.query(q, [
    row.id,
    row.tenant_id,
    row.user_id,
    row.first_name,
    row.last_name,
    row.email.toLowerCase(),
    row.phone,
    row.department_id,
    row.role,
    row.employment_type,
    row.skills,
    row.day_rate_amount,
    row.day_rate_currency,
    row.per_diem_amount,
    row.per_diem_currency,
    row.status,
    row.emergency_contact,
    row.metadata,
    row.custom_fields ?? {},
    row.photo_document_id ?? null,
  ]);
  const full = await findPersonnelById(db, row.tenant_id, row.id, true);
  if (!full) throw new Error("insertPersonnel: row not found after insert");
  return full;
}

export async function findPersonnelById(
  db: Db,
  tenantId: string,
  id: string,
  includeDeactivated: boolean,
): Promise<PersonnelRowInternal | null> {
  const statusClause = includeDeactivated ? "" : "AND p.status <> 'inactive'";
  const q = `
    SELECT p.*, d.name AS department_name
    FROM personnel p
    LEFT JOIN departments d ON d.id = p.department_id AND d.tenant_id = p.tenant_id AND d.deleted_at IS NULL
    WHERE p.tenant_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
    ${statusClause}
  `;
  const res = await db.query(q, [tenantId, id]);
  if (res.rows.length === 0) return null;
  return mapPersonnelRow(res.rows[0] as Record<string, unknown>);
}

export async function findPersonnelByEmail(
  db: Db,
  tenantId: string,
  email: string,
): Promise<PersonnelRowInternal | null> {
  const q = `
    SELECT p.*, d.name AS department_name
    FROM personnel p
    LEFT JOIN departments d ON d.id = p.department_id AND d.tenant_id = p.tenant_id AND d.deleted_at IS NULL
    WHERE p.tenant_id = $1 AND lower(p.email) = lower($2) AND p.deleted_at IS NULL
  `;
  const res = await db.query(q, [tenantId, email]);
  if (res.rows.length === 0) return null;
  return mapPersonnelRow(res.rows[0] as Record<string, unknown>);
}

export type PersonnelListFilters = {
  status?: PersonnelStatus[];
  department_id?: string;
  employment_type?: EmploymentType[];
  role?: string;
  skill?: string;
  search?: string;
};

export async function countPersonnel(
  db: Db,
  tenantId: string,
  filters: PersonnelListFilters,
): Promise<number> {
  const { where, values } = buildPersonnelWhere(tenantId, filters);
  const q = `SELECT COUNT(*)::int AS c FROM personnel p ${where}`;
  const res = await db.query(q, values);
  return Number(res.rows[0].c);
}

function buildPersonnelWhere(
  tenantId: string,
  filters: PersonnelListFilters,
): { where: string; values: unknown[] } {
  const values: unknown[] = [tenantId];
  let i = 2;
  const parts: string[] = ["WHERE p.tenant_id = $1 AND p.deleted_at IS NULL"];
  if (filters.status?.length) {
    parts.push(`AND p.status = ANY($${i}::text[])`);
    values.push(filters.status);
    i++;
  }
  if (filters.department_id) {
    parts.push(`AND p.department_id = $${i}`);
    values.push(filters.department_id);
    i++;
  }
  if (filters.employment_type?.length) {
    parts.push(`AND p.employment_type = ANY($${i}::text[])`);
    values.push(filters.employment_type);
    i++;
  }
  if (filters.role) {
    parts.push(`AND p.role ILIKE $${i}`);
    values.push(`%${filters.role}%`);
    i++;
  }
  if (filters.skill) {
    parts.push(`AND $${i} = ANY(p.skills)`);
    values.push(filters.skill);
    i++;
  }
  if (filters.search) {
    const term = `%${filters.search}%`;
    parts.push(
      `AND (p.first_name ILIKE $${i} OR p.last_name ILIKE $${i} OR p.email ILIKE $${i} OR p.role ILIKE $${i} OR (p.first_name || ' ' || p.last_name) ILIKE $${i})`,
    );
    values.push(term);
    i++;
  }
  return { where: parts.join(" "), values };
}

type SortKey = "name" | "role" | "department" | "created_at";

export function orderByClause(sort: SortKey, order: "asc" | "desc"): string {
  const dir = order === "asc" ? "ASC" : "DESC";
  switch (sort) {
    case "name":
      return `ORDER BY lower(p.last_name) ${dir}, lower(p.first_name) ${dir}, p.id ${dir}`;
    case "role":
      return `ORDER BY lower(p.role) ${dir}, p.id ${dir}`;
    case "department":
      return `ORDER BY lower(d.name) NULLS LAST, p.id ${dir}`;
    case "created_at":
      return `ORDER BY p.created_at ${dir}, p.id ${dir}`;
    default:
      return `ORDER BY lower(p.last_name) ASC, lower(p.first_name) ASC, p.id ASC`;
  }
}

export async function listPersonnel(
  db: Db,
  tenantId: string,
  filters: PersonnelListFilters,
  sort: SortKey,
  order: "asc" | "desc",
  offset: number,
  limit: number,
): Promise<PersonnelRowInternal[]> {
  const { where, values } = buildPersonnelWhere(tenantId, filters);
  const ob = orderByClause(sort, order);
  const limIdx = values.length + 1;
  const offIdx = values.length + 2;
  const q = `
    SELECT p.*, d.name AS department_name
    FROM personnel p
    LEFT JOIN departments d ON d.id = p.department_id AND d.tenant_id = p.tenant_id AND d.deleted_at IS NULL
    ${where}
    ${ob}
    LIMIT $${limIdx} OFFSET $${offIdx}
  `;
  const res = await db.query(q, [...values, limit, offset]);
  return res.rows.map((r) => mapPersonnelRow(r as Record<string, unknown>));
}

export async function updatePersonnel(
  db: Db,
  tenantId: string,
  id: string,
  patch: Record<string, unknown>,
  expectedVersion: number | undefined,
): Promise<PersonnelRowInternal | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;

  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${n}`);
    vals.push(val);
    n++;
  };

  if ("first_name" in patch) add("first_name", patch.first_name);
  if ("last_name" in patch) add("last_name", patch.last_name);
  if ("email" in patch) add("email", String(patch.email).toLowerCase());
  if ("phone" in patch) add("phone", patch.phone);
  if ("department_id" in patch) add("department_id", patch.department_id);
  if ("role" in patch) add("role", patch.role);
  if ("employment_type" in patch) add("employment_type", patch.employment_type);
  if ("skills" in patch) add("skills", patch.skills);
  if ("day_rate_amount" in patch) add("day_rate_amount", patch.day_rate_amount);
  if ("day_rate_currency" in patch) add("day_rate_currency", patch.day_rate_currency);
  if ("per_diem_amount" in patch) add("per_diem_amount", patch.per_diem_amount);
  if ("per_diem_currency" in patch) add("per_diem_currency", patch.per_diem_currency);
  if ("status" in patch) add("status", patch.status);
  if ("emergency_contact" in patch) add("emergency_contact", patch.emergency_contact);
  if ("metadata" in patch) add("metadata", patch.metadata);
  if ("custom_fields" in patch) add("custom_fields", patch.custom_fields);
  if ("photo_document_id" in patch) add("photo_document_id", patch.photo_document_id);

  if (sets.length === 0) {
    return findPersonnelById(db, tenantId, id, true);
  }

  sets.push("version = version + 1");
  sets.push("updated_at = NOW()");

  const iTenant = n;
  const iId = n + 1;
  vals.push(tenantId, id);
  let where = `WHERE tenant_id = $${iTenant} AND id = $${iId} AND deleted_at IS NULL`;
  n += 2;
  if (expectedVersion !== undefined) {
    vals.push(expectedVersion);
    where += ` AND version = $${n}`;
    n++;
  }

  const q = `UPDATE personnel SET ${sets.join(", ")} ${where} RETURNING id`;
  const res = await db.query(q, vals);
  if (res.rows.length === 0) return null;
  return findPersonnelById(db, tenantId, id, true);
}

export async function deactivatePersonnel(
  db: Db,
  tenantId: string,
  id: string,
): Promise<{ id: string; deactivated_at: string } | null> {
  const q = `
    UPDATE personnel
    SET status = 'inactive', deactivated_at = NOW(), updated_at = NOW(), version = version + 1
    WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
    RETURNING id, deactivated_at
  `;
  const res = await db.query(q, [tenantId, id]);
  if (res.rows.length === 0) return null;
  return {
    id: String(res.rows[0].id),
    deactivated_at: new Date(String(res.rows[0].deactivated_at)).toISOString(),
  };
}

export async function countDepartmentPersonnel(
  db: Db,
  tenantId: string,
  departmentId: string,
): Promise<number> {
  const q = `
    SELECT COUNT(*)::int AS c FROM personnel
    WHERE tenant_id = $1 AND department_id = $2 AND deleted_at IS NULL
  `;
  const res = await db.query(q, [tenantId, departmentId]);
  return Number(res.rows[0].c);
}

export async function listBlockedDatesInRange(
  db: Db,
  tenantId: string,
  personnelId: string,
  start: string,
  end: string,
): Promise<{ start_date: string; end_date: string }[]> {
  const q = `
    SELECT start_date, end_date FROM personnel_blocked_dates
    WHERE tenant_id = $1 AND personnel_id = $2
      AND end_date >= $3::date AND start_date <= $4::date
  `;
  const res = await db.query(q, [tenantId, personnelId, start, end]);
  return res.rows.map((r) => ({
    start_date: String(r.start_date),
    end_date: String(r.end_date),
  }));
}

export async function listBlockedDatesForPersonnelIdsInRange(
  db: Db,
  tenantId: string,
  personnelIds: string[],
  start: string,
  end: string,
): Promise<{ personnel_id: string; start_date: string; end_date: string }[]> {
  if (personnelIds.length === 0) return [];
  const q = `
    SELECT personnel_id, start_date, end_date FROM personnel_blocked_dates
    WHERE tenant_id = $1 AND personnel_id = ANY($2::uuid[])
      AND end_date >= $3::date AND start_date <= $4::date
  `;
  const res = await db.query(q, [tenantId, personnelIds, start, end]);
  return res.rows.map((r) => ({
    personnel_id: String(r.personnel_id),
    start_date: String(r.start_date),
    end_date: String(r.end_date),
  }));
}
