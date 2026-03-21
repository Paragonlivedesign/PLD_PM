import { pool } from "../../db/pool.js";
import { generateDocumentInternal } from "./documents.service.js";
import { LocalFileStorageAdapter } from "./storage.js";

export {
  documentsRouter,
  templatesRouter,
  riderItemsRouter,
  emailDraftsRouter,
} from "./routes.js";
export { registerDocumentStaleListeners } from "./listeners.js";
export { getDocumentsByEvent, getTemplates } from "./documents.service.js";

const internalStorage = new LocalFileStorageAdapter();

/** Internal — programmatic document generation (e.g. Financial module). */
export async function generateDocument(
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
): Promise<{ document_id: string; status: "complete" | "processing"; download_url: string | null }> {
  return generateDocumentInternal(pool, tenantId, userId, templateId, context, internalStorage);
}
