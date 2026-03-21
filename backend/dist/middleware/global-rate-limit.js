const buckets = new Map();
function clientIp(req) {
    return String(req.ip || req.socket.remoteAddress || "").trim() || "unknown";
}
/** Local browser → local API (127.0.0.1 / ::1): SPA boot issues many parallel requests; do not throttle. */
function isLoopbackClient(req) {
    const ip = clientIp(req);
    if (ip === "unknown")
        return false;
    if (ip === "127.0.0.1" || ip === "::1")
        return true;
    if (ip.startsWith("127."))
        return true;
    if (ip === "::ffff:127.0.0.1")
        return true;
    return false;
}
function parsePositiveInt(raw, fallback) {
    if (raw == null || raw === "")
        return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}
/**
 * Simple per-IP sliding window. Disabled when `PLD_RATE_LIMIT_DISABLED=1`.
 * Tunable: `PLD_RATE_LIMIT_MAX` (default 2000 req/window), `PLD_RATE_LIMIT_WINDOW_MS` (default 60000).
 * Loopback clients are never limited (local dev).
 */
export function globalRateLimitMiddleware(req, res, next) {
    if (process.env.PLD_RATE_LIMIT_DISABLED === "1") {
        next();
        return;
    }
    const path = req.path ?? "";
    if (path === "/health" || path === "/api/v1/health") {
        next();
        return;
    }
    if (isLoopbackClient(req)) {
        next();
        return;
    }
    const max = parsePositiveInt(process.env.PLD_RATE_LIMIT_MAX, 2000);
    const windowMs = parsePositiveInt(process.env.PLD_RATE_LIMIT_WINDOW_MS, 60_000);
    const ip = clientIp(req);
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || now > b.resetAt) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(ip, b);
    }
    b.count += 1;
    if (b.count > max) {
        res.status(429).json({
            data: null,
            meta: req.correlationId ? { correlation_id: req.correlationId } : {},
            errors: [{ code: "RATE_LIMITED", message: "Too many requests" }],
        });
        return;
    }
    next();
}
