import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";

export type StoredObjectMeta = {
  storageKey: string;
  sizeBytes: number;
};

export interface FileStorageAdapter {
  /** Relative key under tenant, e.g. `documents/2026/abc.pdf` */
  saveStream(
    tenantId: string,
    relativeKey: string,
    stream: Readable | ReadableStream,
    mimeType: string,
  ): Promise<StoredObjectMeta>;
  deleteObject(tenantId: string, storageKey: string): Promise<void>;
  getAbsolutePath(tenantId: string, storageKey: string): string;
}

function rootDir(): string {
  return process.env.DOCUMENTS_STORAGE_ROOT ?? join(process.cwd(), "data", "documents");
}

export class LocalFileStorageAdapter implements FileStorageAdapter {
  getAbsolutePath(tenantId: string, storageKey: string): string {
    const base = join(rootDir(), tenantId);
    return join(base, storageKey);
  }

  async saveStream(
    tenantId: string,
    relativeKey: string,
    stream: Readable | ReadableStream,
    _mimeType: string,
  ): Promise<StoredObjectMeta> {
    void _mimeType;
    const abs = this.getAbsolutePath(tenantId, relativeKey);
    await mkdir(dirname(abs), { recursive: true });
    const ws = createWriteStream(abs);
    const nodeReadable =
      stream instanceof Readable ? stream : Readable.fromWeb(stream as ReadableStream);
    await pipeline(nodeReadable, ws);
    const { statSync } = await import("node:fs");
    const st = statSync(abs);
    return { storageKey: relativeKey, sizeBytes: st.size };
  }

  async deleteObject(tenantId: string, storageKey: string): Promise<void> {
    const abs = this.getAbsolutePath(tenantId, storageKey);
    try {
      await unlink(abs);
    } catch (e: unknown) {
      const err = e as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw e;
    }
  }
}
