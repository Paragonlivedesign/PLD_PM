import { Readable } from "node:stream";
import { Router } from "express";
import multer from "multer";
import { ok } from "../../core/envelope.js";
import { HttpError } from "../../core/http-error.js";
import {
  asyncHandler,
  requestContextMiddleware,
  requirePermission,
  resumeRequestContextMiddleware,
} from "../../core/middleware.js";
import * as svc from "./documents.service.js";
import { LocalFileStorageAdapter } from "./storage.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(id: string, field = "id"): void {
  if (!UUID_RE.test(id)) {
    throw new HttpError(400, "VALIDATION", `Invalid ${field}`, field);
  }
}

function paramId(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return String(p[0] ?? "");
  return String(p ?? "");
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const storage = new LocalFileStorageAdapter();

function parseTags(raw: unknown): string[] | undefined {
  if (raw == null || raw === "") return undefined;
  if (Array.isArray(raw)) return raw.map(String);
  const s = String(raw);
  try {
    const j = JSON.parse(s) as unknown;
    if (Array.isArray(j)) return j.map(String);
  } catch {
    /* fall through */
  }
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export const documentsRouter = Router();
documentsRouter.use(requestContextMiddleware);

documentsRouter.post(
  "/upload",
  requirePermission("documents:upload"),
  upload.single("file"),
  resumeRequestContextMiddleware,
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file?.buffer) {
      throw new HttpError(400, "VALIDATION", "file is required", "file");
    }
    const b = req.body as Record<string, string | undefined>;
    const category = String(b.category ?? "");
    if (!category) throw new HttpError(400, "VALIDATION", "category is required", "category");
    const stream = Readable.from(file.buffer);
    const result = await svc.uploadDocumentApi(storage, {
      stream,
      originalName: file.originalname || "upload",
      mimeType: file.mimetype || "application/octet-stream",
      sizeKnown: file.size,
      fields: {
        event_id: b.event_id,
        entity_type: b.entity_type,
        entity_id: b.entity_id,
        category,
        name: b.name,
        description: b.description,
        tags: parseTags(b.tags),
        visibility: b.visibility,
        rider_items_json: b.rider_items_json,
      },
      req,
    });
    res.status(201).json(ok(result.data, result.meta));
  }),
);

documentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const result = await svc.listDocumentsApi(storage, q);
    res.status(200).json(ok(result.data, result.meta));
  }),
);

documentsRouter.post(
  "/generate",
  requirePermission("documents:generate"),
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const template_id = String(body.template_id ?? "");
    const event_id = String(body.event_id ?? "");
    assertUuid(template_id, "template_id");
    assertUuid(event_id, "event_id");
    const result = await svc.generateDocumentApi(
      storage,
      {
        template_id,
        event_id,
        output_format: body.output_format != null ? String(body.output_format) : undefined,
        data_overrides:
          body.data_overrides && typeof body.data_overrides === "object"
            ? (body.data_overrides as Record<string, unknown>)
            : undefined,
        name: body.name != null ? String(body.name) : undefined,
        category: body.category != null ? String(body.category) : undefined,
        visibility: body.visibility != null ? String(body.visibility) : undefined,
      },
      req,
    );
    res.status(201).json(ok(result.data, result.meta));
  }),
);

documentsRouter.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const token = String(req.query.token ?? "");
    if (!token) throw new HttpError(400, "VALIDATION", "token is required", "token");
    const file = await svc.streamDocumentFile(storage, token, id);
    if (!file) throw new HttpError(403, "FORBIDDEN", "Invalid or expired download link");
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    file.stream.pipe(res);
  }),
);

documentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const result = await svc.getDocumentApi(storage, id, req);
    res.status(200).json(ok(result.data, result.meta));
  }),
);

documentsRouter.delete(
  "/:id",
  requirePermission("documents:delete"),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.deleteDocumentApi(storage, id);
    res.status(200).json(ok(data));
  }),
);

export const templatesRouter = Router();
templatesRouter.use(requestContextMiddleware);

templatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const data = await svc.listTemplatesApi(q);
    res.status(200).json(ok(data));
  }),
);

templatesRouter.get(
  "/variable-catalog",
  asyncHandler(async (_req, res) => {
    const data = svc.listTemplateVariableCatalogApi();
    res.status(200).json(ok(data));
  }),
);

templatesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.getTemplateByIdApi(id);
    res.status(200).json(ok(data));
  }),
);

templatesRouter.post(
  "/",
  requirePermission("templates:create"),
  asyncHandler(async (req, res) => {
    const data = await svc.createTemplateApi(req.body as Record<string, unknown>);
    res.status(201).json(ok(data));
  }),
);

templatesRouter.put(
  "/:id",
  requirePermission("templates:update"),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const { data, meta } = await svc.updateTemplateApi(id, req.body as Record<string, unknown>);
    res.status(200).json(ok(data, meta));
  }),
);

export const riderItemsRouter = Router();
riderItemsRouter.use(requestContextMiddleware);

riderItemsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string | undefined>;
    const result = await svc.listRiderItemsApi(q);
    res.status(200).json(ok(result.data, result.meta));
  }),
);

riderItemsRouter.post(
  "/",
  requirePermission("documents:update"),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      document_id?: string;
      event_id?: string;
      items?: { description: string; category?: string; quantity?: number; source_line?: string }[];
    };
    const result = await svc.batchCreateRiderItemsApi({
      document_id: String(body.document_id ?? ""),
      event_id: String(body.event_id ?? ""),
      items: body.items ?? [],
    });
    res.status(201).json(ok(result.data, result.meta));
  }),
);

riderItemsRouter.put(
  "/:id",
  requirePermission("documents:update"),
  asyncHandler(async (req, res) => {
    const id = paramId(req.params.id);
    assertUuid(id);
    const data = await svc.updateRiderItemApi(id, req.body as Record<string, unknown>);
    res.status(200).json(ok(data));
  }),
);

export const emailDraftsRouter = Router();
emailDraftsRouter.use(requestContextMiddleware);

emailDraftsRouter.post(
  "/",
  requirePermission("documents:generate"),
  asyncHandler(async (req, res) => {
    const data = await svc.createEmailDraftApi(req.body as Record<string, unknown>);
    res.status(201).json(ok(data));
  }),
);
