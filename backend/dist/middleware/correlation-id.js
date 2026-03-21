import { randomUUID } from "node:crypto";
/**
 * Accepts `X-Correlation-Id` or generates a UUID; echoes via response header.
 */
export function correlationIdMiddleware(req, res, next) {
    const incoming = req.header("x-correlation-id")?.trim();
    const id = incoming && incoming.length > 0 ? incoming : randomUUID();
    req.correlationId = id;
    res.setHeader("X-Correlation-Id", id);
    next();
}
