import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { basename } from "node:path";
import type { Readable } from "node:stream";
import type { Pool } from "pg";
import { domainBus } from "../../domain/bus.js";
import { getContext } from "../../core/context.js";
import { HttpError } from "../../core/http-error.js";
import { pool } from "../../db/pool.js";
import { getFieldDefinitions } from "../custom-fields/service.js";
import { getEventByIdInternal } from "../events/service.js";
import { listPersonnelBriefInternal, getPersonnelById } from "../personnel/index.js";
import { createDownloadToken, verifyDownloadToken } from "./download-token.js";
import { buildHtmlMergeSectionsForEvent } from "./document-merge-sections.js";
import { buildGenerationContext, renderTemplateHtml } from "./generate-html.js";
import type { TemplateMergeKeyDefinition } from "./template-merge-catalog.js";
import { TEMPLATE_VARIABLE_CATALOG } from "./template-merge-catalog.js";
import * as repo from "./repository.js";
import type { DocumentRow, RiderRow, TemplateRow } from "./repository.js";
import type { LocalFileStorageAdapter } from "./storage.js";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const DOC_CATEGORIES = new Set([
  "contract",
  "rider",
  "invoice",
  "production_schedule",
  "stage_plot",
  "tech_spec",
  "photo",
  "other",
]);

const VISIBILITY = new Set(["internal", "client", "public"]);

const RIDER_CATS = new Set([
  "audio",
  "lighting",
  "video",
  "staging",
  "backline",
  "catering",
  "hospitality",
  "transport",
  "other",
]);

const TEMPLATE_CATEGORIES = new Set([
  "contract",
  "rider",
  "invoice",
  "production_schedule",
  "stage_plot",
  "tech_spec",
  "report",
  "day_sheet",
  "crew_pack",
  "other",
]);

function docCategoryFromTemplate(tplCat: string): string {
  if (DOC_CATEGORIES.has(tplCat)) return tplCat;
  return "other";
}

function allowedMime(mime: string): boolean {
  const m = mime.toLowerCase().trim();
  if (
    m === "application/pdf" ||
    m === "application/msword" ||
    m === "text/plain" ||
    m === "text/csv"
  )
    return true;
  if (m.startsWith("image/")) return true;
  if (m.startsWith("application/vnd.openxmlformats-officedocument.")) return true;
  return false;
}

export function toDocumentApi(row: DocumentRow, storage: LocalFileStorageAdapter): Record<string, unknown> {
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    event_id: row.event_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    category: row.category,
    source: row.source,
    visibility: row.visibility,
    mime_type: row.mime_type,
    size_bytes: Number(row.size_bytes),
    file_path: `${row.tenant_id}/…/${basename(row.storage_key)}`,
    tags,
    generated_from_template: row.generated_from_template_id,
    version: row.doc_version,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    stale: row.stale,
  };
}

function publicBaseUrl(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const host = req.get("host") ?? `localhost:${process.env.PORT ?? 3000}`;
  return `${req.protocol}://${host}`;
}

export async function uploadDocumentApi(
  storage: LocalFileStorageAdapter,
  input: {
    stream: Readable;
    originalName: string;
    mimeType: string;
    sizeKnown?: number;
    fields: {
      event_id?: string;
      entity_type?: string;
      entity_id?: string;
      category: string;
      name?: string;
      description?: string;
      tags?: string[];
      visibility?: string;
      rider_items_json?: string;
    };
    req: { protocol: string; get: (h: string) => string | undefined };
  },
): Promise<{ data: Record<string, unknown>; meta: Record<string, unknown> }> {
  const ctx = getContext();
  const cat = input.fields.category;
  if (!DOC_CATEGORIES.has(cat)) {
    throw new HttpError(400, "VALIDATION", "Invalid category", "category");
  }
  const vis = input.fields.visibility ?? "internal";
  if (!VISIBILITY.has(vis)) {
    throw new HttpError(400, "VALIDATION", "Invalid visibility", "visibility");
  }
  if (!allowedMime(input.mimeType)) {
    throw new HttpError(400, "VALIDATION", "Unsupported MIME type", "file");
  }
  if (input.sizeKnown != null && input.sizeKnown > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "File exceeds 50 MB limit", "file");
  }

  const id = randomUUID();
  const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "upload";
  const relKey = `documents/${new Date().toISOString().slice(0, 10)}/${id}_${safeName}`;

  const meta = await storage.saveStream(ctx.tenantId, relKey, input.stream, input.mimeType);
  if (meta.sizeBytes > MAX_UPLOAD_BYTES) {
    await storage.deleteObject(ctx.tenantId, relKey);
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "File exceeds 50 MB limit", "file");
  }

  const displayName = input.fields.name?.trim() || basename(input.originalName) || "Document";

  const row = await repo.insertDocument(pool, {
    id,
    tenant_id: ctx.tenantId,
    event_id: input.fields.event_id ?? null,
    entity_type: input.fields.entity_type ?? null,
    entity_id: input.fields.entity_id ?? null,
    category: cat,
    name: displayName,
    description: input.fields.description ?? null,
    source: "uploaded",
    visibility: vis,
    mime_type: input.mimeType,
    size_bytes: String(meta.sizeBytes),
    storage_key: meta.storageKey,
    tags: input.fields.tags ?? [],
    generated_from_template_id: null,
    doc_version: 1,
    uploaded_by: ctx.userId,
    processing_status: "complete",
  });

  domainBus.emit("document.uploaded", {
    document_id: row.id,
    tenant_id: ctx.tenantId,
    event_id: row.event_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    name: row.name,
    category: row.category,
    mime_type: row.mime_type,
    size_bytes: Number(row.size_bytes),
    visibility: row.visibility,
    uploaded_by: row.uploaded_by,
    uploaded_at: row.created_at,
  });

  if (cat === "rider" && input.fields.rider_items_json?.trim() && row.event_id) {
    const riderEventId = row.event_id as string;
    try {
      const parsed = JSON.parse(input.fields.rider_items_json) as {
        description: string;
        category?: string;
        quantity?: number;
      }[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const items = parsed.map((it) => ({
          id: randomUUID(),
          tenant_id: ctx.tenantId,
          document_id: row.id,
          event_id: riderEventId,
          description: String(it.description ?? "").slice(0, 2000) || "Item",
          category:
            it.category && RIDER_CATS.has(String(it.category)) ? String(it.category) : "other",
          quantity: typeof it.quantity === "number" && it.quantity > 0 ? Math.floor(it.quantity) : 1,
          status: "pending",
          notes: null as string | null,
          assigned_to: null as string | null,
          estimated_cost: null as number | null,
          source_line: null as string | null,
        }));
        await repo.insertRiderItems(pool, items);
        const cats = [...new Set(items.map((i) => i.category))];
        domainBus.emit("rider.processed", {
          document_id: row.id,
          tenant_id: ctx.tenantId,
          event_id: row.event_id,
          items_extracted: items.length,
          categories_found: cats,
          processed_at: new Date().toISOString(),
        });
      }
    } catch {
      /* ignore malformed rider_items_json */
    }
  }

  const dl = createDownloadToken(row.id, ctx.tenantId);
  return {
    data: toDocumentApi(row, storage),
    meta: {
      upload_size_bytes: meta.sizeBytes,
      processing_status: "complete",
      download_url: `${publicBaseUrl(input.req)}/api/v1/documents/${row.id}/file?token=${encodeURIComponent(dl.token)}`,
      download_url_expires_at: dl.expiresAt,
    },
  };
}

export async function listDocumentsApi(
  storage: LocalFileStorageAdapter,
  query: Record<string, string | undefined>,
): Promise<{
  data: Record<string, unknown>[];
  meta: { cursor: string | null; has_more: boolean; total_count: number };
}> {
  const ctx = getContext();
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
  const sortByRaw = query.sort_by ?? "created_at";
  const sort_by =
    sortByRaw === "name" || sortByRaw === "category" || sortByRaw === "size"
      ? sortByRaw
      : "created_at";
  const sort_order = query.sort_order === "asc" ? "asc" : "desc";
  const curRaw = decodeURIComponent(query.cursor ?? "");
  const decoded = repo.decodeDocumentCursor(curRaw || undefined);
  const cursor =
    decoded && decoded.sortBy === sort_by
      ? { v: decoded.v, id: decoded.id }
      : null;

  const { rows, total } = await repo.listDocuments(pool, ctx.tenantId, {
    event_id: query.event_id,
    entity_type: query.entity_type,
    entity_id: query.entity_id,
    category: query.category
      ? query.category.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    visibility: query.visibility
      ? query.visibility.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    source: query.source === "uploaded" || query.source === "generated" ? query.source : undefined,
    search: query.search,
    sort_by,
    sort_order,
    limit: limit + 1,
    cursor,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? repo.documentCursor(last, sort_by) : null;

  return {
    data: slice.map((r) => toDocumentApi(r, storage)),
    meta: { cursor: nextCursor, has_more: hasMore, total_count: total },
  };
}

export async function getDocumentApi(
  storage: LocalFileStorageAdapter,
  id: string,
  req: { protocol: string; get: (h: string) => string | undefined },
): Promise<{ data: Record<string, unknown>; meta: Record<string, unknown> }> {
  const ctx = getContext();
  const row = await repo.getDocumentById(pool, ctx.tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Document not found");
  const { token, expiresAt } = createDownloadToken(id, ctx.tenantId);
  const url = `${publicBaseUrl(req)}/api/v1/documents/${id}/file?token=${encodeURIComponent(token)}`;
  return {
    data: toDocumentApi(row, storage),
    meta: { download_url: url, download_url_expires_at: expiresAt },
  };
}

export async function deleteDocumentApi(
  storage: LocalFileStorageAdapter,
  id: string,
): Promise<{ id: string; deleted_at: string }> {
  const ctx = getContext();
  const row = await repo.getDocumentById(pool, ctx.tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Document not found");
  const del = await repo.softDeleteDocument(pool, ctx.tenantId, id);
  if (!del) throw new HttpError(404, "NOT_FOUND", "Document not found");
  await storage.deleteObject(ctx.tenantId, row.storage_key);
  return del;
}

export async function streamDocumentFile(
  storage: LocalFileStorageAdapter,
  token: string,
  expectedDocumentId: string,
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; fileName: string } | null> {
  const parsed = verifyDownloadToken(token);
  if (!parsed || parsed.documentId !== expectedDocumentId) return null;
  const row = await repo.getDocumentById(pool, parsed.tenantId, parsed.documentId);
  if (!row || row.deleted_at) return null;
  const abs = storage.getAbsolutePath(row.tenant_id, row.storage_key);
  return {
    stream: createReadStream(abs),
    mimeType: row.mime_type,
    fileName: row.name,
  };
}

export async function generateDocumentApi(
  storage: LocalFileStorageAdapter,
  body: {
    template_id: string;
    event_id: string;
    output_format?: string;
    data_overrides?: Record<string, unknown>;
    name?: string;
    category?: string;
    visibility?: string;
  },
  req: { protocol: string; get: (h: string) => string | undefined },
): Promise<{ data: Record<string, unknown>; meta: Record<string, unknown> }> {
  const ctx = getContext();
  const t0 = Date.now();
  const tpl = await repo.getTemplateById(pool, ctx.tenantId, body.template_id);
  if (!tpl || !tpl.is_active) throw new HttpError(404, "NOT_FOUND", "Template not found");
  const ev = await getEventByIdInternal(body.event_id, ctx.tenantId);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");

  const personnel = await listPersonnelBriefInternal(ctx.tenantId, { limit: 500 });
  const defs = await getFieldDefinitions(pool, ctx.tenantId, "event", { include_deprecated: false });
  const flat = buildGenerationContext({
    event: ev,
    personnel,
    fieldDefinitions: defs,
    dataOverrides: body.data_overrides,
  });
  const sections = await buildHtmlMergeSectionsForEvent(ctx.tenantId, body.event_id);
  flat.schedule_section = sections.schedule_section;
  flat.travel_section = sections.travel_section;
  flat.financial_section = sections.financial_section;
  const html =
    tpl.format === "markdown"
      ? `<pre>${renderTemplateHtml(tpl.content, flat)}</pre>`
      : renderTemplateHtml(tpl.content, flat);

  const docName = body.name?.trim() || `${tpl.name} — ${ev.name}`;
  const category =
    body.category && DOC_CATEGORIES.has(body.category)
      ? body.category
      : docCategoryFromTemplate(tpl.category);
  const vis = body.visibility && VISIBILITY.has(body.visibility) ? body.visibility : "internal";

  const id = randomUUID();
  const relKey = `documents/generated/${id}.html`;
  const { Readable } = await import("node:stream");
  const stream = Readable.from([html], { objectMode: false });
  const meta = await storage.saveStream(ctx.tenantId, relKey, stream, "text/html");

  const row = await repo.insertDocument(pool, {
    id,
    tenant_id: ctx.tenantId,
    event_id: body.event_id,
    entity_type: null,
    entity_id: null,
    category,
    name: docName,
    description: null,
    source: "generated",
    visibility: vis,
    mime_type: "text/html",
    size_bytes: String(meta.sizeBytes),
    storage_key: meta.storageKey,
    tags: [],
    generated_from_template_id: tpl.id,
    doc_version: 1,
    uploaded_by: ctx.userId,
    processing_status: "complete",
    stale: false,
  });

  const ms = Date.now() - t0;
  domainBus.emit("document.generated", {
    document_id: row.id,
    tenant_id: ctx.tenantId,
    event_id: body.event_id,
    template_id: tpl.id,
    template_name: tpl.name,
    name: row.name,
    category: row.category,
    output_format: body.output_format ?? tpl.default_output_format ?? "pdf",
    generation_time_ms: ms,
    generated_by: ctx.userId,
    generated_at: row.created_at,
  });

  const dl = createDownloadToken(row.id, ctx.tenantId);
  return {
    data: toDocumentApi(row, storage),
    meta: {
      generated_from_template: tpl.id,
      generation_time_ms: ms,
      download_url: `${publicBaseUrl(req)}/api/v1/documents/${row.id}/file?token=${encodeURIComponent(dl.token)}`,
      download_url_expires_at: dl.expiresAt,
    },
  };
}

// --- internal exports for other modules ---

export async function getDocumentsByEvent(
  db: Pool,
  tenantId: string,
  eventId: string,
  options?: { category?: string[]; visibility?: string[]; source?: "uploaded" | "generated" },
): Promise<Record<string, unknown>[]> {
  const storage = new (await import("./storage.js")).LocalFileStorageAdapter();
  const { rows } = await repo.listDocuments(db, tenantId, {
    event_id: eventId,
    category: options?.category,
    visibility: options?.visibility,
    source: options?.source,
    sort_by: "created_at",
    sort_order: "desc",
    limit: 500,
    cursor: null,
  });
  return rows.map((r) => toDocumentApi(r, storage));
}

export async function getTemplates(
  db: Pool,
  tenantId: string,
  options?: { category?: string[]; active_only?: boolean },
): Promise<Record<string, unknown>[]> {
  const rows = await repo.listTemplates(db, tenantId, {
    category: options?.category,
    sort_by: "name",
    sort_order: "asc",
    active_only: options?.active_only ?? true,
  });
  return rows.map(toTemplateApi);
}

function toTemplateApi(t: TemplateRow): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    format: t.format,
    variables: t.variables,
    default_output_format: t.default_output_format,
    version: t.version,
    is_active: t.is_active,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

/** Full template including `content` (for GET by id — list omits body for size). */
function toTemplateDetailApi(t: TemplateRow): Record<string, unknown> {
  return { ...toTemplateApi(t), content: t.content };
}

export async function getTemplateByIdApi(id: string): Promise<Record<string, unknown>> {
  const ctx = getContext();
  const row = await repo.getTemplateById(pool, ctx.tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Template not found");
  return toTemplateDetailApi(row);
}

export async function generateDocumentInternal(
  db: Pool,
  tenantId: string,
  userId: string,
  templateId: string,
  context: {
    event_id: string;
    data?: Record<string, unknown>;
    output_format?: string;
    name?: string;
    category?: string;
    visibility?: string;
  },
  storage: LocalFileStorageAdapter,
): Promise<{ document_id: string; status: "complete" | "processing"; download_url: string | null }> {
  const tpl = await repo.getTemplateById(db, tenantId, templateId);
  if (!tpl || !tpl.is_active) {
    throw new Error("Template not found");
  }
  const ev = await getEventByIdInternal(context.event_id, tenantId);
  if (!ev) throw new Error("Event not found");
  const personnel = await listPersonnelBriefInternal(tenantId, { limit: 500 });
  const defs = await getFieldDefinitions(db, tenantId, "event", { include_deprecated: false });
  const flat = buildGenerationContext({
    event: ev,
    personnel,
    fieldDefinitions: defs,
    dataOverrides: { ...context.data },
  });
  const sections = await buildHtmlMergeSectionsForEvent(tenantId, context.event_id);
  flat.schedule_section = sections.schedule_section;
  flat.travel_section = sections.travel_section;
  flat.financial_section = sections.financial_section;
  const html =
    tpl.format === "markdown"
      ? `<pre>${renderTemplateHtml(tpl.content, flat)}</pre>`
      : renderTemplateHtml(tpl.content, flat);
  const docName = context.name?.trim() || `${tpl.name} — ${ev.name}`;
  const category =
    context.category && DOC_CATEGORIES.has(context.category)
      ? context.category
      : docCategoryFromTemplate(tpl.category);
  const vis =
    context.visibility && VISIBILITY.has(context.visibility) ? context.visibility : "internal";
  const id = randomUUID();
  const relKey = `documents/generated/${id}.html`;
  const { Readable } = await import("node:stream");
  const stream = Readable.from([html], { objectMode: false });
  const meta = await storage.saveStream(tenantId, relKey, stream, "text/html");
  const row = await repo.insertDocument(db, {
    id,
    tenant_id: tenantId,
    event_id: context.event_id,
    entity_type: null,
    entity_id: null,
    category,
    name: docName,
    description: null,
    source: "generated",
    visibility: vis,
    mime_type: "text/html",
    size_bytes: String(meta.sizeBytes),
    storage_key: meta.storageKey,
    tags: [],
    generated_from_template_id: tpl.id,
    doc_version: 1,
    uploaded_by: userId,
    processing_status: "complete",
    stale: false,
  });
  const { token } = createDownloadToken(row.id, tenantId);
  const base = process.env.PUBLIC_API_BASE ?? "http://127.0.0.1:3000";
  return {
    document_id: row.id,
    status: "complete",
    download_url: `${base}/api/v1/documents/${row.id}/file?token=${encodeURIComponent(token)}`,
  };
}

// --- templates HTTP ---

/** Public catalog of `{{merge_keys}}` for template authors (UI + integrations). */
export function listTemplateVariableCatalogApi(): TemplateMergeKeyDefinition[] {
  return [...TEMPLATE_VARIABLE_CATALOG];
}

export async function listTemplatesApi(query: Record<string, string | undefined>): Promise<
  Record<string, unknown>[]
> {
  const ctx = getContext();
  const sortByRaw = query.sort_by ?? "name";
  const sort_by =
    sortByRaw === "created_at" || sortByRaw === "category" ? sortByRaw : "name";
  const sort_order = query.sort_order === "desc" ? "desc" : "asc";
  const rows = await repo.listTemplates(pool, ctx.tenantId, {
    category: query.category
      ? query.category.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    search: query.search,
    sort_by,
    sort_order,
    active_only: true,
  });
  return rows.map(toTemplateApi);
}

export async function createTemplateApi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ctx = getContext();
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 255) throw new HttpError(400, "VALIDATION", "Invalid name", "name");
  const category = String(body.category ?? "");
  if (!TEMPLATE_CATEGORIES.has(category)) {
    throw new HttpError(400, "VALIDATION", "Invalid category", "category");
  }
  const content = String(body.content ?? "");
  const format = String(body.format ?? "html");
  if (!["html", "markdown", "docx_xml"].includes(format)) {
    throw new HttpError(400, "VALIDATION", "Invalid format", "format");
  }
  const id = randomUUID();
  const row = await repo.insertTemplate(pool, {
    id,
    tenant_id: ctx.tenantId,
    name,
    description: body.description != null ? String(body.description) : null,
    category,
    content,
    format,
    variables: body.variables ?? [],
    default_output_format: String(body.default_output_format ?? "pdf"),
    is_active: body.is_active !== false,
  });
  return toTemplateApi(row);
}

export async function updateTemplateApi(
  id: string,
  body: Record<string, unknown>,
): Promise<{ data: Record<string, unknown>; meta: { version: number } }> {
  const ctx = getContext();
  const existing = await repo.getTemplateById(pool, ctx.tenantId, id);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Template not found");
  const patch: Parameters<typeof repo.updateTemplate>[3] = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.description !== undefined) patch.description = body.description == null ? null : String(body.description);
  if (body.category !== undefined) patch.category = String(body.category);
  if (body.content !== undefined) patch.content = String(body.content);
  if (body.format !== undefined) patch.format = String(body.format);
  if (body.variables !== undefined) patch.variables = body.variables;
  if (body.default_output_format !== undefined)
    patch.default_output_format = String(body.default_output_format);
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
  const row = await repo.updateTemplate(pool, ctx.tenantId, id, patch);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Template not found");
  return { data: toTemplateApi(row), meta: { version: row.version } };
}

// --- rider ---

const RIDER_STATUS = new Set(["pending", "confirmed", "sourced", "declined"]);

function decodeRiderCursor(raw: string | undefined): number {
  if (!raw?.trim()) return 0;
  try {
    const o = Number(Buffer.from(raw, "base64url").toString("utf8"));
    return Number.isFinite(o) && o >= 0 ? o : 0;
  } catch {
    return 0;
  }
}

function encodeRiderCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export async function listRiderItemsApi(query: Record<string, string | undefined>): Promise<{
  data: Record<string, unknown>[];
  meta: { cursor: string | null; has_more: boolean; total_count: number };
}> {
  const ctx = getContext();
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 50) || 50));
  const offset = decodeRiderCursor(query.cursor);
  const { rows, total } = await repo.listRiderItems(pool, ctx.tenantId, {
    event_id: query.event_id,
    document_id: query.document_id,
    category: query.category,
    status: query.status,
    search: query.search,
    limit: limit + 1,
    offset,
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const enriched = await Promise.all(slice.map((r) => toRiderApi(r)));
  return {
    data: enriched,
    meta: {
      cursor: hasMore ? encodeRiderCursor(offset + limit) : null,
      has_more: hasMore,
      total_count: total,
    },
  };
}

async function toRiderApi(r: RiderRow): Promise<Record<string, unknown>> {
  let assignedName: string | null = null;
  if (r.assigned_to) {
    const p = await getPersonnelById(r.assigned_to, r.tenant_id, { include_deactivated: true });
    if (p) assignedName = `${p.first_name} ${p.last_name}`;
  }
  return {
    id: r.id,
    document_id: r.document_id,
    event_id: r.event_id,
    description: r.description,
    category: r.category,
    quantity: r.quantity,
    status: r.status,
    notes: r.notes,
    assigned_to: r.assigned_to,
    assigned_to_name: assignedName,
    estimated_cost: r.estimated_cost != null ? Number(r.estimated_cost) : null,
    source_line: r.source_line,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export async function updateRiderItemApi(
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const ctx = getContext();
  const existing = await repo.getRiderById(pool, ctx.tenantId, id);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Rider item not found");
  const patch: Parameters<typeof repo.updateRiderItem>[3] = {};
  if (body.category !== undefined) {
    const c = String(body.category);
    if (!RIDER_CATS.has(c)) throw new HttpError(400, "VALIDATION", "Invalid category", "category");
    patch.category = c;
  }
  if (body.status !== undefined) {
    const s = String(body.status);
    if (!RIDER_STATUS.has(s)) throw new HttpError(400, "VALIDATION", "Invalid status", "status");
    patch.status = s;
  }
  if (body.quantity !== undefined) {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 1) throw new HttpError(400, "VALIDATION", "Invalid quantity", "quantity");
    patch.quantity = q;
  }
  if (body.notes !== undefined) patch.notes = body.notes == null ? null : String(body.notes);
  if (body.assigned_to !== undefined)
    patch.assigned_to = body.assigned_to == null ? null : String(body.assigned_to);
  if (body.estimated_cost !== undefined)
    patch.estimated_cost =
      body.estimated_cost == null ? null : Number(body.estimated_cost);
  const row = await repo.updateRiderItem(pool, ctx.tenantId, id, patch);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Rider item not found");
  return toRiderApi(row);
}

export async function batchCreateRiderItemsApi(body: {
  document_id: string;
  event_id: string;
  items: { description: string; category?: string; quantity?: number; source_line?: string }[];
}): Promise<{ data: Record<string, unknown>[]; meta: Record<string, unknown> }> {
  const ctx = getContext();
  if (!body.items?.length) throw new HttpError(400, "VALIDATION", "items required", "items");
  const doc = await repo.getDocumentById(pool, ctx.tenantId, body.document_id);
  if (!doc) throw new HttpError(404, "NOT_FOUND", "Document not found");
  const ev = await getEventByIdInternal(body.event_id, ctx.tenantId);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");
  const rows = body.items.map((it) => ({
    id: randomUUID(),
    tenant_id: ctx.tenantId,
    document_id: body.document_id,
    event_id: body.event_id,
    description: String(it.description ?? "").slice(0, 2000) || "Item",
    category:
      it.category && RIDER_CATS.has(it.category) ? it.category : "other",
    quantity: typeof it.quantity === "number" && it.quantity > 0 ? Math.floor(it.quantity) : 1,
    status: "pending",
    notes: null as string | null,
    assigned_to: null as string | null,
    estimated_cost: null as number | null,
    source_line: it.source_line ?? null,
  }));
  const inserted = await repo.insertRiderItems(pool, rows);
  const cats = [...new Set(rows.map((i) => i.category))];
  domainBus.emit("rider.processed", {
    document_id: body.document_id,
    tenant_id: ctx.tenantId,
    event_id: body.event_id,
    items_extracted: inserted.length,
    categories_found: cats,
    processed_at: new Date().toISOString(),
  });
  return {
    data: await Promise.all(inserted.map((r) => toRiderApi(r))),
    meta: { count: inserted.length },
  };
}

// --- email drafts ---

export async function createEmailDraftApi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ctx = getContext();
  const eventId = String(body.event_id ?? "");
  const to = Array.isArray(body.to) ? (body.to as unknown[]).map(String) : [];
  const subject = String(body.subject ?? "");
  if (!eventId || !to.length || !subject) {
    throw new HttpError(400, "VALIDATION", "event_id, to, subject required");
  }
  const ev = await getEventByIdInternal(eventId, ctx.tenantId);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");
  const cc = Array.isArray(body.cc) ? (body.cc as unknown[]).map(String) : [];
  const bodyText = String(body.body ?? "");
  const bodyHtml = bodyText ? `<p>${escHtml(bodyText)}</p>` : "<p></p>";
  const attachments: { document_id: string; name: string; size_bytes: number }[] = [];
  if (Array.isArray(body.attachments)) {
    for (const aid of body.attachments as string[]) {
      const d = await repo.getDocumentById(pool, ctx.tenantId, aid);
      if (d) {
        attachments.push({
          document_id: d.id,
          name: d.name,
          size_bytes: Number(d.size_bytes),
        });
      }
    }
  }
  const id = randomUUID();
  const row = await repo.insertEmailDraft(pool, {
    id,
    tenant_id: ctx.tenantId,
    event_id: eventId,
    template_id: body.template_id ? String(body.template_id) : null,
    to_addresses: to,
    cc_addresses: cc,
    subject,
    body_html: bodyHtml,
    body_text: bodyText,
    attachments,
    status: "draft",
  });
  return {
    id: row.id,
    event_id: row.event_id,
    to,
    cc,
    subject,
    body_html: row.body_html,
    body_text: row.body_text,
    attachments,
    status: row.status,
    created_at: row.created_at,
  };
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}