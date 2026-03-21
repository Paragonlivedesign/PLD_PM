import { pool } from "../../db/pool.js";
import { generateDocumentInternal } from "./documents.service.js";
import { LocalFileStorageAdapter } from "./storage.js";
export { documentsRouter, templatesRouter, riderItemsRouter, emailDraftsRouter, } from "./routes.js";
export { registerDocumentStaleListeners } from "./listeners.js";
export { getDocumentsByEvent, getTemplates } from "./documents.service.js";
const internalStorage = new LocalFileStorageAdapter();
/** Internal — programmatic document generation (e.g. Financial module). */
export async function generateDocument(tenantId, userId, templateId, context) {
    return generateDocumentInternal(pool, tenantId, userId, templateId, context, internalStorage);
}
