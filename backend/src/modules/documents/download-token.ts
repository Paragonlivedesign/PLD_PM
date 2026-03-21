import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.DOCUMENT_DOWNLOAD_SECRET ?? "dev-document-download-secret-change-me";
}

function sign(payload: string): Buffer {
  return createHmac("sha256", secret()).update(payload).digest();
}

export function createDownloadToken(documentId: string, tenantId: string): {
  token: string;
  expiresAt: string;
} {
  const exp = Date.now() + TTL_MS;
  const payload = `${documentId}|${tenantId}|${exp}`;
  const sig = sign(payload).toString("hex");
  const token = Buffer.from(JSON.stringify({ d: documentId, t: tenantId, e: exp, s: sig }), "utf8").toString(
    "base64url",
  );
  return { token, expiresAt: new Date(exp).toISOString() };
}

export function verifyDownloadToken(
  token: string,
): { documentId: string; tenantId: string } | null {
  try {
    const raw = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      d?: string;
      t?: string;
      e?: number;
      s?: string;
    };
    if (!raw.d || !raw.t || typeof raw.e !== "number" || !raw.s) return null;
    if (Date.now() > raw.e) return null;
    const payload = `${raw.d}|${raw.t}|${raw.e}`;
    const expected = sign(payload).toString("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(raw.s, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { documentId: raw.d, tenantId: raw.t };
  } catch {
    return null;
  }
}
