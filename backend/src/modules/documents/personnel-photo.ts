import type { Pool } from "pg";
import { HttpError } from "../../core/http-error.js";
import { createDownloadToken } from "./download-token.js";
import * as repo from "./repository.js";

export async function validatePersonnelPhotoDocument(
  pool: Pool,
  tenantId: string,
  documentId: string,
  personnelId?: string | null,
): Promise<void> {
  const row = await repo.getDocumentById(pool, tenantId, documentId);
  if (!row) {
    throw new HttpError(404, "NOT_FOUND", "Photo document not found", "photo_document_id");
  }
  if (row.category !== "photo") {
    throw new HttpError(400, "VALIDATION", "Document must have category photo", "photo_document_id");
  }
  if (!String(row.mime_type).toLowerCase().startsWith("image/")) {
    throw new HttpError(400, "VALIDATION", "Document must be an image", "photo_document_id");
  }
  if (personnelId && row.entity_id && row.entity_id !== personnelId) {
    throw new HttpError(400, "VALIDATION", "Photo is linked to another record", "photo_document_id");
  }
}

export function buildDocumentFilePublicUrl(
  documentId: string,
  tenantId: string,
  req: { protocol: string; get: (h: string) => string | undefined },
): { url: string; expires_at: string } {
  const host = req.get("host") ?? `localhost:${process.env.PORT ?? 3000}`;
  const base = `${req.protocol}://${host}`;
  const dl = createDownloadToken(documentId, tenantId);
  return {
    url: `${base}/api/v1/documents/${documentId}/file?token=${encodeURIComponent(dl.token)}`,
    expires_at: dl.expiresAt,
  };
}
