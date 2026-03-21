import { randomUUID } from "node:crypto";
import { getContext } from "../../core/context.js";
import { HttpError } from "../../core/http-error.js";
import { pool } from "../../core/database.js";
import * as deptRepo from "../tenancy/department.repository.js";
import {
  emitBulkImportCompleted,
  emitPersonnelCreated,
  emitPersonnelRateChanged,
  emitPersonnelUpdated,
} from "./personnel.events.js";
import * as pRepo from "./personnel.repository.js";
import {
  assertEmail,
  assertEmploymentType,
  assertPersonnelStatus,
} from "./personnel.validator.js";
import type { EmploymentType, PersonnelStatus } from "./personnel.types.js";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;
const SESSION_TTL_MS = 60 * 60 * 1000;

const TARGET_FIELDS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "department_id",
  "department",
  "role",
  "employment_type",
  "day_rate",
  "per_diem",
  "skills",
  "status",
  "ignore",
]);

type ImportSession = {
  tenantId: string;
  userId: string;
  createdAtMs: number;
  headers: string[];
  rows: string[][];
};

const sessions = new Map<string, ImportSession>();

/** Minimal CSV parser (quoted fields, \r\n). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((x) => x.length > 0)) lines.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  row.push(cur);
  if (row.some((x) => x.length > 0)) lines.push(row);

  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0]!.map((h) => h.trim());
  const rows = lines.slice(1).map((r) => {
    const out = [...r];
    while (out.length < headers.length) out.push("");
    return out.slice(0, headers.length);
  });
  return { headers, rows };
}

function getSession(sessionId: string): ImportSession {
  const s = sessions.get(sessionId);
  if (!s) throw new HttpError(404, "NOT_FOUND", "Import session not found", "session_id");
  if (Date.now() - s.createdAtMs > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new HttpError(410, "GONE", "Import session expired", "session_id");
  }
  const ctx = getContext();
  if (s.tenantId !== ctx.tenantId) {
    throw new HttpError(403, "FORBIDDEN", "Session belongs to another tenant");
  }
  return s;
}

function cell(row: string[], headers: string[], headerName: string): string {
  const idx = headers.indexOf(headerName);
  if (idx < 0) return "";
  return String(row[idx] ?? "").trim();
}

type ColumnMap = Record<string, string>;

function normalizeColumnMap(sess: ImportSession, raw: Record<string, unknown>): ColumnMap {
  const map: ColumnMap = {};
  const usedTargets = new Set<string>();
  for (const h of sess.headers) {
    const v = raw[h];
    if (v === undefined || v === null || String(v) === "") continue;
    const target = String(v).trim();
    if (target === "ignore") continue;
    if (!TARGET_FIELDS.has(target)) {
      throw new HttpError(400, "VALIDATION", `Unknown target field: ${target}`, "column_map");
    }
    if (target !== "ignore" && usedTargets.has(target)) {
      throw new HttpError(400, "VALIDATION", `Duplicate mapping for ${target}`, "column_map");
    }
    usedTargets.add(target);
    map[h] = target;
  }
  return map;
}

type ParsedRow =
  | {
      ok: true;
      rowIndex: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      department_id: string | null;
      role: string;
      employment_type: EmploymentType;
      day_rate: number | null;
      per_diem: number | null;
      skills: string[];
      status: PersonnelStatus;
    }
  | { ok: false; rowIndex: number; message: string; field?: string };

function parseSkills(s: string): string[] {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildParsedRows(
  sess: ImportSession,
  columnMap: ColumnMap,
  deptByLowerName: Map<string, string>,
): ParsedRow[] {
  const { headers, rows } = sess;
  const out: ParsedRow[] = [];
  let idx = 0;
  for (const row of rows) {
    const rowIndex = idx;
    idx++;
    try {
      const vals: Record<string, string> = {};
      for (const h of headers) {
        const target = columnMap[h];
        if (!target || target === "ignore") continue;
        vals[target] = cell(row, headers, h);
      }
      const email = (vals.email ?? "").trim();
      if (!email) {
        out.push({ ok: false, rowIndex, message: "email required", field: "email" });
        continue;
      }
      assertEmail(email);
      const first_name = (vals.first_name ?? "").trim();
      const last_name = (vals.last_name ?? "").trim();
      if (!first_name || !last_name) {
        out.push({
          ok: false,
          rowIndex,
          message: "first_name and last_name required",
          field: "first_name",
        });
        continue;
      }
      const role = (vals.role ?? "").trim();
      if (!role) {
        out.push({ ok: false, rowIndex, message: "role required", field: "role" });
        continue;
      }
      const employmentRaw = (vals.employment_type ?? "freelance").trim();
      assertEmploymentType(employmentRaw);
      const employment_type = employmentRaw as EmploymentType;

      let department_id: string | null = null;
      if (vals.department_id) {
        department_id = vals.department_id.trim();
      } else if (vals.department) {
        const id = deptByLowerName.get(vals.department.trim().toLowerCase());
        if (!id) {
          out.push({
            ok: false,
            rowIndex,
            message: `Unknown department: ${vals.department}`,
            field: "department",
          });
          continue;
        }
        department_id = id;
      }

      let status: PersonnelStatus = "active";
      if (vals.status) {
        assertPersonnelStatus(vals.status.trim());
        status = vals.status.trim() as PersonnelStatus;
      }

      let day_rate: number | null = null;
      if (vals.day_rate) {
        const n = Number(vals.day_rate);
        if (Number.isNaN(n)) {
          out.push({ ok: false, rowIndex, message: "Invalid day_rate", field: "day_rate" });
          continue;
        }
        day_rate = n;
      }
      let per_diem: number | null = null;
      if (vals.per_diem) {
        const n = Number(vals.per_diem);
        if (Number.isNaN(n)) {
          out.push({ ok: false, rowIndex, message: "Invalid per_diem", field: "per_diem" });
          continue;
        }
        per_diem = n;
      }

      const phone = vals.phone?.trim() ? vals.phone.trim() : null;
      const skills = parseSkills(vals.skills ?? "");

      out.push({
        ok: true,
        rowIndex,
        first_name,
        last_name,
        email,
        phone,
        department_id,
        role,
        employment_type,
        day_rate,
        per_diem,
        skills,
        status,
      });
    } catch (e) {
      const msg = e instanceof HttpError ? e.message : "Validation error";
      const field = e instanceof HttpError ? e.field : undefined;
      out.push({ ok: false, rowIndex, message: msg, field });
    }
  }
  return out;
}

export async function personnelImportUpload(body: Record<string, unknown>): Promise<{
  session_id: string;
  columns: string[];
  sample_rows: string[][];
  row_count: number;
}> {
  const ctx = getContext();
  const csv_text = String(body.csv_text ?? "");
  if (!csv_text.trim()) throw new HttpError(400, "VALIDATION", "csv_text required", "csv_text");
  if (csv_text.length > MAX_CSV_BYTES) {
    throw new HttpError(400, "VALIDATION", "CSV exceeds maximum size", "csv_text");
  }
  const { headers, rows } = parseCsv(csv_text);
  if (headers.length === 0) throw new HttpError(400, "VALIDATION", "No header row", "csv_text");
  if (rows.length > MAX_ROWS) {
    throw new HttpError(400, "VALIDATION", `Maximum ${MAX_ROWS} data rows`, "csv_text");
  }
  const session_id = randomUUID();
  sessions.set(session_id, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    createdAtMs: Date.now(),
    headers,
    rows,
  });
  return {
    session_id,
    columns: headers,
    sample_rows: rows.slice(0, 5),
    row_count: rows.length,
  };
}

export async function personnelImportValidate(body: Record<string, unknown>): Promise<{
  session_id: string;
  valid: number;
  errors: { row_index: number; message: string; field?: string }[];
  column_map: ColumnMap;
}> {
  const session_id = String(body.session_id ?? "");
  if (!session_id) throw new HttpError(400, "VALIDATION", "session_id required", "session_id");
  const sess = getSession(session_id);
  const column_map = normalizeColumnMap(sess, (body.column_map as Record<string, unknown>) ?? {});
  if (!Object.keys(column_map).length) {
    throw new HttpError(400, "VALIDATION", "column_map required", "column_map");
  }
  const targets = new Set(Object.values(column_map));
  if (!targets.has("email")) {
    throw new HttpError(400, "VALIDATION", "Map one column to email", "column_map");
  }

  const depts = await deptRepo.listDepartments(pool, sess.tenantId, "active_only", false);
  const deptByLowerName = new Map<string, string>();
  for (const d of depts) {
    deptByLowerName.set(d.name.trim().toLowerCase(), d.id);
  }

  const parsed = buildParsedRows(sess, column_map, deptByLowerName);
  const errors = parsed
    .filter((p): p is Extract<ParsedRow, { ok: false }> => !p.ok)
    .map((p) => ({ row_index: p.rowIndex, message: p.message, field: p.field }));
  const valid = parsed.filter((p) => p.ok).length;

  return { session_id, valid, errors, column_map };
}

export async function personnelImportPreview(body: Record<string, unknown>): Promise<{
  session_id: string;
  new_count: number;
  update_count: number;
  skip_count: number;
  preview: {
    row_index: number;
    action: "create" | "update" | "skip";
    email: string;
    diff?: Record<string, { from: unknown; to: unknown }>;
    reason?: string;
  }[];
}> {
  const session_id = String(body.session_id ?? "");
  if (!session_id) throw new HttpError(400, "VALIDATION", "session_id required", "session_id");
  const column_map = (body.column_map as ColumnMap) ?? {};
  const sess = getSession(session_id);
  const depts = await deptRepo.listDepartments(pool, sess.tenantId, "active_only", false);
  const deptByLowerName = new Map<string, string>();
  for (const d of depts) {
    deptByLowerName.set(d.name.trim().toLowerCase(), d.id);
  }
  const parsed = buildParsedRows(sess, column_map, deptByLowerName);
  const preview: {
    row_index: number;
    action: "create" | "update" | "skip";
    email: string;
    diff?: Record<string, { from: unknown; to: unknown }>;
    reason?: string;
  }[] = [];
  let new_count = 0;
  let update_count = 0;
  let skip_count = 0;

  for (const p of parsed) {
    if (!p.ok) {
      skip_count++;
      preview.push({
        row_index: p.rowIndex,
        action: "skip",
        email: "",
        reason: p.message,
      });
      continue;
    }
    const existing = await pRepo.findPersonnelByEmail(pool, sess.tenantId, p.email);
    if (!existing) {
      new_count++;
      preview.push({ row_index: p.rowIndex, action: "create", email: p.email });
      continue;
    }
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    const add = (k: string, from: unknown, to: unknown) => {
      if (from !== to) diff[k] = { from, to };
    };
    add("first_name", existing.first_name, p.first_name);
    add("last_name", existing.last_name, p.last_name);
    add("phone", existing.phone, p.phone);
    add("department_id", existing.department_id, p.department_id);
    add("role", existing.role, p.role);
    add("employment_type", existing.employment_type, p.employment_type);
    add("day_rate", existing.day_rate, p.day_rate);
    add("per_diem", existing.per_diem, p.per_diem);
    add("skills", JSON.stringify(existing.skills), JSON.stringify(p.skills));
    add("status", existing.status, p.status);
    if (Object.keys(diff).length === 0) {
      skip_count++;
      preview.push({
        row_index: p.rowIndex,
        action: "skip",
        email: p.email,
        reason: "No changes",
      });
    } else {
      update_count++;
      preview.push({ row_index: p.rowIndex, action: "update", email: p.email, diff });
    }
  }

  return { session_id, new_count, update_count, skip_count, preview };
}

const DEFAULT_CURRENCY = "USD";

export async function personnelImportConfirm(body: Record<string, unknown>): Promise<{
  created: number;
  updated: number;
  skipped: number;
  session_id: string;
}> {
  const session_id = String(body.session_id ?? "");
  if (!session_id) throw new HttpError(400, "VALIDATION", "session_id required", "session_id");
  const column_map = (body.column_map as ColumnMap) ?? {};
  const sess = getSession(session_id);
  const ctx = getContext();
  const depts = await deptRepo.listDepartments(pool, sess.tenantId, "active_only", false);
  const deptByLowerName = new Map<string, string>();
  for (const d of depts) {
    deptByLowerName.set(d.name.trim().toLowerCase(), d.id);
  }
  const parsed = buildParsedRows(sess, column_map, deptByLowerName);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of parsed) {
      if (!p.ok) {
        skipped++;
        continue;
      }
      const existing = await pRepo.findPersonnelByEmail(client, sess.tenantId, p.email);
      if (!existing) {
        const id = randomUUID();
        await pRepo.insertPersonnel(client, {
          id,
          tenant_id: sess.tenantId,
          user_id: null,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          phone: p.phone,
          department_id: p.department_id,
          role: p.role,
          employment_type: p.employment_type,
          skills: p.skills,
          day_rate_amount: p.day_rate,
          day_rate_currency: DEFAULT_CURRENCY,
          per_diem_amount: p.per_diem,
          per_diem_currency: DEFAULT_CURRENCY,
          status: p.status,
          emergency_contact: null,
          metadata: {},
        });
        const row = await pRepo.findPersonnelById(client, sess.tenantId, id, true);
        if (row) {
          emitPersonnelCreated({
            personnel_id: id,
            tenant_id: sess.tenantId,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            role: p.role,
            department_id: p.department_id,
            employment_type: p.employment_type,
            created_by: ctx.userId,
            created_at: row.created_at,
          });
        }
        created++;
      } else {
        const patch: Record<string, unknown> = {
          first_name: p.first_name,
          last_name: p.last_name,
          phone: p.phone,
          department_id: p.department_id,
          role: p.role,
          employment_type: p.employment_type,
          skills: p.skills,
          day_rate_amount: p.day_rate,
          day_rate_currency: DEFAULT_CURRENCY,
          per_diem_amount: p.per_diem,
          per_diem_currency: DEFAULT_CURRENCY,
          status: p.status,
        };
        const updatedRow = await pRepo.updatePersonnel(
          client,
          sess.tenantId,
          existing.id,
          patch,
          undefined,
        );
        if (!updatedRow) {
          skipped++;
          continue;
        }
        const changed = Object.keys(patch);
        emitPersonnelUpdated({
          personnel_id: existing.id,
          tenant_id: sess.tenantId,
          changed_fields: changed,
          previous_values: existing as unknown as Record<string, unknown>,
          new_values: patch,
          updated_by: ctx.userId,
          updated_at: updatedRow.updated_at,
        });
        const rateChanged =
          (p.day_rate ?? null) !== (existing.day_rate ?? null) ||
          (p.per_diem ?? null) !== (existing.per_diem ?? null);
        if (rateChanged) {
          emitPersonnelRateChanged({
            personnel_id: existing.id,
            tenant_id: sess.tenantId,
            old_day_rate: existing.day_rate,
            new_day_rate: updatedRow.day_rate,
            old_per_diem: existing.per_diem,
            new_per_diem: updatedRow.per_diem,
            currency: DEFAULT_CURRENCY,
            updated_by: ctx.userId,
            updated_at: updatedRow.updated_at,
          });
        }
        updated++;
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  emitBulkImportCompleted({
    tenant_id: sess.tenantId,
    session_id,
    created,
    updated,
    skipped,
    completed_by: ctx.userId,
    completed_at: new Date().toISOString(),
  });
  sessions.delete(session_id);

  return { created, updated, skipped, session_id };
}
