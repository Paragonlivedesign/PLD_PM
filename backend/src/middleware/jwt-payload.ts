import type { Request } from "express";

function base64UrlToJson(segment: string): Record<string, unknown> | null {
  try {
    const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = Buffer.from(b64, "base64").toString("utf8");
    const o = JSON.parse(json) as unknown;
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Decodes JWT payload without signature verification (dev / until auth hardening). */
export function decodeBearerPayload(req: Request): Record<string, unknown> | null {
  const h = req.header("authorization") ?? req.header("Authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return null;
  const token = h.slice(7).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  return base64UrlToJson(parts[1]);
}
