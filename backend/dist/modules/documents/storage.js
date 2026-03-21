import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
function rootDir() {
    return process.env.DOCUMENTS_STORAGE_ROOT ?? join(process.cwd(), "data", "documents");
}
export class LocalFileStorageAdapter {
    getAbsolutePath(tenantId, storageKey) {
        const base = join(rootDir(), tenantId);
        return join(base, storageKey);
    }
    async saveStream(tenantId, relativeKey, stream, _mimeType) {
        void _mimeType;
        const abs = this.getAbsolutePath(tenantId, relativeKey);
        await mkdir(dirname(abs), { recursive: true });
        const ws = createWriteStream(abs);
        const nodeReadable = stream instanceof Readable ? stream : Readable.fromWeb(stream);
        await pipeline(nodeReadable, ws);
        const { statSync } = await import("node:fs");
        const st = statSync(abs);
        return { storageKey: relativeKey, sizeBytes: st.size };
    }
    async deleteObject(tenantId, storageKey) {
        const abs = this.getAbsolutePath(tenantId, storageKey);
        try {
            await unlink(abs);
        }
        catch (e) {
            const err = e;
            if (err.code !== "ENOENT")
                throw e;
        }
    }
}
