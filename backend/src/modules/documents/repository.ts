import type { Pool } from "pg";
import { randomUUID } from "node:crypto";

export type DocumentRow = {
  id: string;
  tenant_id: string;
  event_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  category: string;
  name: string;
  description: string | null;
  source: string;
  visibility: string;
  mime_type: string;
  size_bytes: string;
  storage_key: string;
  tags: unknown;
  generated_from_template_id: string | null;
  doc_version: number;
  uploaded_by: string;
  processing_status: string;
  stale: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplateRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string;
  content: string;
  format: string;
  variables: unknown;
  default_output_format: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RiderRow = {
  id: string;
  tenant_id: string;
  document_id: string;
  event_id: string;
  description: string;
  category: string;
  quantity: number;
  status: string;
  notes: string | null;
  assigned_to: string | null;
  estimated_cost: string | null;
  source_line: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailDraftRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  template_id: string | null;
  to_addresses: unknown;
  cc_addresses: unknown;
  subject: string;
  body_html: string;
  body_text: string;
  attachments: unknown;
  status: string;
  created_at: string;
};

export type ListDocumentsParams = {
  event_id?: string;
  entity_type?: string;
  entity_id?: string;
  category?: string[];
  visibility?: string[];
  source?: string;
  search?: string;
  sort_by: "name" | "created_at" | "category" | "size";
  sort_order: "asc" | "desc";
  limit: number;
  cursor?: { v: string; id: string } | null;
};

function sortExpr(sortBy: ListDocumentsParams["sort_by"], order: "asc" | "desc"): string {
  const dir = order === "asc" ? "ASC" : "DESC";
  switch (sortBy) {
    case "name":
      return `ORDER BY lower(d.name) ${dir}, d.id ${dir}`;
    case "category":
      return `ORDER BY d.category ${dir}, d.id ${dir}`;
    case "size":
      return `ORDER BY d.size_bytes ${dir}, d.id ${dir}`;
    case "created_at":
    default:
      return `ORDER BY d.created_at ${dir}, d.id ${dir}`;
  }
}

export async function insertDocument(
  pool: Pool,
  row: Omit<DocumentRow, "deleted_at" | "created_at" | "updated_at" | "stale"> & { stale?: boolean },
): Promise<DocumentRow> {
  const res = await pool.query(
    `INSERT INTO documents (
      id, tenant_id, event_id, entity_type, entity_id, category, name, description,
      source, visibility, mime_type, size_bytes, storage_key, tags,
      generated_from_template_id, doc_version, uploaded_by, processing_status, stale
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19)
    RETURNING *`,
    [
      row.id,
      row.tenant_id,
      row.event_id,
      row.entity_type,
      row.entity_id,
      row.category,
      row.name,
      row.description,
      row.source,
      row.visibility,
      row.mime_type,
      row.size_bytes,
      row.storage_key,
      JSON.stringify(row.tags ?? []),
      row.generated_from_template_id,
      row.doc_version,
      row.uploaded_by,
      row.processing_status,
      row.stale ?? false,
    ],
  );
  return mapDoc(res.rows[0] as Record<string, unknown>);
}

export async function getDocumentById(
  pool: Pool,
  tenantId: string,
  id: string,
  includeDeleted = false,
): Promise<DocumentRow | null> {
  const del = includeDeleted ? "" : "AND d.deleted_at IS NULL";
  const res = await pool.query(
    `SELECT d.* FROM documents d WHERE d.tenant_id = $1 AND d.id = $2 ${del}`,
    [tenantId, id],
  );
  if (!res.rows[0]) return null;
  return mapDoc(res.rows[0] as Record<string, unknown>);
}

export async function softDeleteDocument(
  pool: Pool,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const res = await pool.query(
    `UPDATE documents SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`,
    [tenantId, id],
  );
  if (!res.rows[0]) return null;
  const r = res.rows[0] as { id: string; deleted_at: Date };
  return { id: r.id, deleted_at: r.deleted_at.toISOString() };
}

export async function listDocuments(
  pool: Pool,
  tenantId: string,
  p: ListDocumentsParams,
): Promise<{ rows: DocumentRow[]; total: number }> {
  const conds: string[] = ["d.tenant_id = $1", "d.deleted_at IS NULL"];
  const vals: unknown[] = [tenantId];
  let n = 2;

  if (p.event_id) {
    conds.push(`d.event_id = $${n}`);
    vals.push(p.event_id);
    n++;
  }
  if (p.entity_type) {
    conds.push(`d.entity_type = $${n}`);
    vals.push(p.entity_type);
    n++;
  }
  if (p.entity_id) {
    conds.push(`d.entity_id = $${n}`);
    vals.push(p.entity_id);
    n++;
  }
  if (p.category?.length) {
    conds.push(`d.category = ANY($${n}::text[])`);
    vals.push(p.category);
    n++;
  }
  if (p.visibility?.length) {
    conds.push(`d.visibility = ANY($${n}::text[])`);
    vals.push(p.visibility);
    n++;
  }
  if (p.source) {
    conds.push(`d.source = $${n}`);
    vals.push(p.source);
    n++;
  }
  if (p.search?.trim()) {
    conds.push(
      `(d.name ILIKE $${n} OR d.description ILIKE $${n} OR d.tags::text ILIKE $${n})`,
    );
    vals.push(`%${p.search.trim()}%`);
    n++;
  }

  if (p.cursor) {
    const { v, id } = p.cursor;
    const desc = p.sort_order === "desc";
    const idOp = desc ? "<" : ">";
    if (p.sort_by === "created_at") {
      const tOp = desc ? "<" : ">";
      conds.push(
        `(d.created_at ${tOp} $${n}::timestamptz OR (d.created_at = $${n}::timestamptz AND d.id ${idOp} $${n + 1}::uuid))`,
      );
      vals.push(v, id);
      n += 2;
    } else if (p.sort_by === "name") {
      const tOp = desc ? "<" : ">";
      conds.push(
        `(lower(d.name) ${tOp} lower($${n}::text) OR (lower(d.name) = lower($${n}::text) AND d.id ${idOp} $${n + 1}::uuid))`,
      );
      vals.push(v, id);
      n += 2;
    } else if (p.sort_by === "category") {
      const tOp = desc ? "<" : ">";
      conds.push(
        `(d.category ${tOp} $${n}::text OR (d.category = $${n}::text AND d.id ${idOp} $${n + 1}::uuid))`,
      );
      vals.push(v, id);
      n += 2;
    } else {
      const tOp = desc ? "<" : ">";
      conds.push(
        `(d.size_bytes ${tOp} $${n}::bigint OR (d.size_bytes = $${n}::bigint AND d.id ${idOp} $${n + 1}::uuid))`,
      );
      vals.push(v, id);
      n += 2;
    }
  }

  const where = conds.join(" AND ");
  const ob = sortExpr(p.sort_by, p.sort_order);
  const countRes = await pool.query(`SELECT count(*)::int AS c FROM documents d WHERE ${where}`, vals);
  const total = countRes.rows[0]?.c ?? 0;

  const limIdx = vals.length + 1;
  const q = `SELECT d.* FROM documents d WHERE ${where} ${ob} LIMIT $${limIdx}`;
  const res = await pool.query(q, [...vals, p.limit + 1]);
  const rows = res.rows.map((r) => mapDoc(r as Record<string, unknown>));
  return { rows, total };
}

export async function markGeneratedStaleForEvent(
  pool: Pool,
  tenantId: string,
  eventId: string,
): Promise<number> {
  const res = await pool.query(
    `UPDATE documents SET stale = TRUE, updated_at = NOW()
     WHERE tenant_id = $1 AND event_id = $2 AND source = 'generated' AND deleted_at IS NULL`,
    [tenantId, eventId],
  );
  return res.rowCount ?? 0;
}

export async function markAllGeneratedStaleForTenant(pool: Pool, tenantId: string): Promise<number> {
  const res = await pool.query(
    `UPDATE documents SET stale = TRUE, updated_at = NOW()
     WHERE tenant_id = $1 AND source = 'generated' AND deleted_at IS NULL`,
    [tenantId],
  );
  return res.rowCount ?? 0;
}

function mapDoc(r: Record<string, unknown>): DocumentRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    event_id: r.event_id ? String(r.event_id) : null,
    entity_type: r.entity_type != null ? String(r.entity_type) : null,
    entity_id: r.entity_id ? String(r.entity_id) : null,
    category: String(r.category),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    source: String(r.source),
    visibility: String(r.visibility),
    mime_type: String(r.mime_type),
    size_bytes: String(r.size_bytes),
    storage_key: String(r.storage_key),
    tags: r.tags,
    generated_from_template_id: r.generated_from_template_id
      ? String(r.generated_from_template_id)
      : null,
    doc_version: Number(r.doc_version),
    uploaded_by: String(r.uploaded_by),
    processing_status: String(r.processing_status),
    stale: Boolean(r.stale),
    deleted_at: r.deleted_at ? new Date(r.deleted_at as Date).toISOString() : null,
    created_at: new Date(r.created_at as Date).toISOString(),
    updated_at: new Date(r.updated_at as Date).toISOString(),
  };
}

export function documentCursor(row: DocumentRow, sortBy: ListDocumentsParams["sort_by"]): string {
  let v: string;
  switch (sortBy) {
    case "name":
      v = row.name.toLowerCase();
      break;
    case "category":
      v = row.category;
      break;
    case "size":
      v = row.size_bytes;
      break;
    case "created_at":
    default:
      v = row.created_at;
      break;
  }
  return Buffer.from(JSON.stringify({ v, id: row.id, sb: sortBy }), "utf8").toString("base64url");
}

export function decodeDocumentCursor(
  raw: string | undefined,
): { v: string; id: string; sortBy: ListDocumentsParams["sort_by"] } | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      v?: string;
      id?: string;
      sb?: string;
    };
    const keys = ["name", "created_at", "category", "size"];
    if (j.v != null && j.id != null && j.sb != null && keys.includes(j.sb)) {
      return { v: j.v, id: j.id, sortBy: j.sb as ListDocumentsParams["sort_by"] };
    }
  } catch {
    /* ignore */
  }
  return null;
}

// --- templates ---

export async function insertTemplate(
  pool: Pool,
  row: {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    category: string;
    content: string;
    format: string;
    variables: unknown;
    default_output_format: string;
    is_active: boolean;
  },
): Promise<TemplateRow> {
  const res = await pool.query(
    `INSERT INTO document_templates (
      id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`,
    [
      row.id,
      row.tenant_id,
      row.name,
      row.description,
      row.category,
      row.content,
      row.format,
      JSON.stringify(row.variables ?? []),
      row.default_output_format,
      row.is_active,
    ],
  );
  return mapTpl(res.rows[0] as Record<string, unknown>);
}

export async function updateTemplate(
  pool: Pool,
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    category?: string;
    content?: string;
    format?: string;
    variables?: unknown;
    default_output_format?: string;
    is_active?: boolean;
  },
): Promise<TemplateRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  let bumpVersion = false;
  if (patch.name !== undefined) {
    sets.push(`name = $${n}`);
    vals.push(patch.name);
    n++;
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${n}`);
    vals.push(patch.description);
    n++;
  }
  if (patch.category !== undefined) {
    sets.push(`category = $${n}`);
    vals.push(patch.category);
    n++;
  }
  if (patch.content !== undefined) {
    sets.push(`content = $${n}`);
    vals.push(patch.content);
    n++;
    bumpVersion = true;
  }
  if (patch.format !== undefined) {
    sets.push(`format = $${n}`);
    vals.push(patch.format);
    n++;
  }
  if (patch.variables !== undefined) {
    sets.push(`variables = $${n}::jsonb`);
    vals.push(JSON.stringify(patch.variables));
    n++;
  }
  if (patch.default_output_format !== undefined) {
    sets.push(`default_output_format = $${n}`);
    vals.push(patch.default_output_format);
    n++;
  }
  if (patch.is_active !== undefined) {
    sets.push(`is_active = $${n}`);
    vals.push(patch.is_active);
    n++;
  }
  if (bumpVersion) sets.push(`version = version + 1`);
  if (sets.length === 0) return getTemplateById(pool, tenantId, id);
  sets.push(`updated_at = NOW()`);
  vals.push(tenantId, id);
  const res = await pool.query(
    `UPDATE document_templates SET ${sets.join(", ")}
     WHERE tenant_id = $${n} AND id = $${n + 1} RETURNING *`,
    vals,
  );
  if (!res.rows[0]) return null;
  return mapTpl(res.rows[0] as Record<string, unknown>);
}

export async function getTemplateById(
  pool: Pool,
  tenantId: string,
  id: string,
): Promise<TemplateRow | null> {
  const res = await pool.query(
    `SELECT * FROM document_templates WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  if (!res.rows[0]) return null;
  return mapTpl(res.rows[0] as Record<string, unknown>);
}

export async function listTemplates(
  pool: Pool,
  tenantId: string,
  options: {
    category?: string[];
    search?: string;
    sort_by: "name" | "created_at" | "category";
    sort_order: "asc" | "desc";
    active_only?: boolean;
  },
): Promise<TemplateRow[]> {
  const conds = ["tenant_id = $1"];
  const vals: unknown[] = [tenantId];
  let n = 2;
  if (options.active_only !== false) {
    conds.push("is_active = TRUE");
  }
  if (options.category?.length) {
    conds.push(`category = ANY($${n}::text[])`);
    vals.push(options.category);
    n++;
  }
  if (options.search?.trim()) {
    conds.push(`(name ILIKE $${n} OR description ILIKE $${n})`);
    vals.push(`%${options.search.trim()}%`);
    n++;
  }
  const ob =
    options.sort_by === "created_at"
      ? `ORDER BY created_at ${options.sort_order === "desc" ? "DESC" : "ASC"}, id`
      : options.sort_by === "category"
        ? `ORDER BY category ${options.sort_order === "desc" ? "DESC" : "ASC"}, lower(name), id`
        : `ORDER BY lower(name) ${options.sort_order === "desc" ? "DESC" : "ASC"}, id`;
  const res = await pool.query(
    `SELECT * FROM document_templates WHERE ${conds.join(" AND ")} ${ob}`,
    vals,
  );
  return res.rows.map((r) => mapTpl(r as Record<string, unknown>));
}

function mapTpl(r: Record<string, unknown>): TemplateRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    name: String(r.name),
    description: r.description != null ? String(r.description) : null,
    category: String(r.category),
    content: String(r.content),
    format: String(r.format),
    variables: r.variables,
    default_output_format: String(r.default_output_format),
    version: Number(r.version),
    is_active: Boolean(r.is_active),
    created_at: new Date(r.created_at as Date).toISOString(),
    updated_at: new Date(r.updated_at as Date).toISOString(),
  };
}

// --- rider ---

export async function insertRiderItems(
  pool: Pool,
  items: {
    id: string;
    tenant_id: string;
    document_id: string;
    event_id: string;
    description: string;
    category: string;
    quantity: number;
    status: string;
    notes: string | null;
    assigned_to: string | null;
    estimated_cost: number | null;
    source_line: string | null;
  }[],
): Promise<RiderRow[]> {
  if (items.length === 0) return [];
  const out: RiderRow[] = [];
  for (const it of items) {
    const res = await pool.query(
      `INSERT INTO rider_items (
        id, tenant_id, document_id, event_id, description, category, quantity, status, notes, assigned_to, estimated_cost, source_line
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        it.id,
        it.tenant_id,
        it.document_id,
        it.event_id,
        it.description,
        it.category,
        it.quantity,
        it.status,
        it.notes,
        it.assigned_to,
        it.estimated_cost,
        it.source_line,
      ],
    );
    out.push(mapRider(res.rows[0] as Record<string, unknown>));
  }
  return out;
}

export async function listRiderItems(
  pool: Pool,
  tenantId: string,
  filters: {
    event_id?: string;
    document_id?: string;
    category?: string;
    status?: string;
    search?: string;
    limit: number;
    offset: number;
  },
): Promise<{ rows: RiderRow[]; total: number }> {
  const conds = ["tenant_id = $1"];
  const vals: unknown[] = [tenantId];
  let n = 2;
  if (filters.event_id) {
    conds.push(`event_id = $${n}`);
    vals.push(filters.event_id);
    n++;
  }
  if (filters.document_id) {
    conds.push(`document_id = $${n}`);
    vals.push(filters.document_id);
    n++;
  }
  if (filters.category) {
    conds.push(`category = $${n}`);
    vals.push(filters.category);
    n++;
  }
  if (filters.status) {
    conds.push(`status = $${n}`);
    vals.push(filters.status);
    n++;
  }
  if (filters.search?.trim()) {
    conds.push(`description ILIKE $${n}`);
    vals.push(`%${filters.search.trim()}%`);
    n++;
  }
  const where = conds.join(" AND ");
  const countRes = await pool.query(`SELECT count(*)::int AS c FROM rider_items WHERE ${where}`, vals);
  const total = countRes.rows[0]?.c ?? 0;
  const iLim = vals.length + 1;
  const iOff = vals.length + 2;
  const res = await pool.query(
    `SELECT * FROM rider_items WHERE ${where} ORDER BY created_at DESC, id LIMIT $${iLim} OFFSET $${iOff}`,
    [...vals, filters.limit, filters.offset],
  );
  return { rows: res.rows.map((r) => mapRider(r as Record<string, unknown>)), total };
}

export async function getRiderById(
  pool: Pool,
  tenantId: string,
  id: string,
): Promise<RiderRow | null> {
  const res = await pool.query(
    `SELECT * FROM rider_items WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  if (!res.rows[0]) return null;
  return mapRider(res.rows[0] as Record<string, unknown>);
}

export async function updateRiderItem(
  pool: Pool,
  tenantId: string,
  id: string,
  patch: {
    category?: string;
    status?: string;
    quantity?: number;
    notes?: string | null;
    assigned_to?: string | null;
    estimated_cost?: number | null;
  },
): Promise<RiderRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  if (patch.category !== undefined) {
    sets.push(`category = $${n}`);
    vals.push(patch.category);
    n++;
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${n}`);
    vals.push(patch.status);
    n++;
  }
  if (patch.quantity !== undefined) {
    sets.push(`quantity = $${n}`);
    vals.push(patch.quantity);
    n++;
  }
  if (patch.notes !== undefined) {
    sets.push(`notes = $${n}`);
    vals.push(patch.notes);
    n++;
  }
  if (patch.assigned_to !== undefined) {
    sets.push(`assigned_to = $${n}`);
    vals.push(patch.assigned_to);
    n++;
  }
  if (patch.estimated_cost !== undefined) {
    sets.push(`estimated_cost = $${n}`);
    vals.push(patch.estimated_cost);
    n++;
  }
  if (sets.length === 0) return getRiderById(pool, tenantId, id);
  sets.push("updated_at = NOW()");
  const ti = n;
  const ii = n + 1;
  vals.push(tenantId, id);
  const res = await pool.query(
    `UPDATE rider_items SET ${sets.join(", ")} WHERE tenant_id = $${ti} AND id = $${ii} RETURNING *`,
    vals,
  );
  if (!res.rows[0]) return null;
  return mapRider(res.rows[0] as Record<string, unknown>);
}

function mapRider(r: Record<string, unknown>): RiderRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    document_id: String(r.document_id),
    event_id: String(r.event_id),
    description: String(r.description),
    category: String(r.category),
    quantity: Number(r.quantity),
    status: String(r.status),
    notes: r.notes != null ? String(r.notes) : null,
    assigned_to: r.assigned_to ? String(r.assigned_to) : null,
    estimated_cost: r.estimated_cost != null ? String(r.estimated_cost) : null,
    source_line: r.source_line != null ? String(r.source_line) : null,
    created_at: new Date(r.created_at as Date).toISOString(),
    updated_at: new Date(r.updated_at as Date).toISOString(),
  };
}

// --- email drafts ---

export async function insertEmailDraft(
  pool: Pool,
  row: {
    id: string;
    tenant_id: string;
    event_id: string;
    template_id: string | null;
    to_addresses: string[];
    cc_addresses: string[];
    subject: string;
    body_html: string;
    body_text: string;
    attachments: unknown;
    status: string;
  },
): Promise<EmailDraftRow> {
  const res = await pool.query(
    `INSERT INTO email_drafts (
      id, tenant_id, event_id, template_id, to_addresses, cc_addresses, subject, body_html, body_text, attachments, status
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11) RETURNING *`,
    [
      row.id,
      row.tenant_id,
      row.event_id,
      row.template_id,
      JSON.stringify(row.to_addresses),
      JSON.stringify(row.cc_addresses),
      row.subject,
      row.body_html,
      row.body_text,
      JSON.stringify(row.attachments ?? []),
      row.status,
    ],
  );
  return mapEmail(res.rows[0] as Record<string, unknown>);
}

function mapEmail(r: Record<string, unknown>): EmailDraftRow {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    event_id: String(r.event_id),
    template_id: r.template_id ? String(r.template_id) : null,
    to_addresses: r.to_addresses,
    cc_addresses: r.cc_addresses,
    subject: String(r.subject),
    body_html: String(r.body_html),
    body_text: String(r.body_text),
    attachments: r.attachments,
    status: String(r.status),
    created_at: new Date(r.created_at as Date).toISOString(),
  };
}

export function newId(): string {
  return randomUUID();
}
