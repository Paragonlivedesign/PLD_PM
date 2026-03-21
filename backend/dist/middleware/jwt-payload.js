function base64UrlToJson(segment) {
    try {
        const pad = segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
        const b64 = segment.replace(/-/g, "+").replace(/_/g, "/") + pad;
        const json = Buffer.from(b64, "base64").toString("utf8");
        const o = JSON.parse(json);
        return o && typeof o === "object" && !Array.isArray(o) ? o : null;
    }
    catch {
        return null;
    }
}
/** Decodes JWT payload without signature verification (dev / until auth hardening). */
export function decodeBearerPayload(req) {
    const h = req.header("authorization") ?? req.header("Authorization");
    if (!h?.toLowerCase().startsWith("bearer "))
        return null;
    const token = h.slice(7).trim();
    const parts = token.split(".");
    if (parts.length !== 3)
        return null;
    return base64UrlToJson(parts[1]);
}
