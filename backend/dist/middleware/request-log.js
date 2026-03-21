/** JSON lines to stdout: method, path, status, duration, correlation id. */
export function requestLogMiddleware(req, res, next) {
    const start = Date.now();
    res.on("finish", () => {
        const line = {
            level: "info",
            msg: "http_request",
            correlationId: req.correlationId ?? "",
            method: req.method,
            path: req.originalUrl ?? req.url,
            status: res.statusCode,
            durationMs: Date.now() - start,
        };
        console.log(JSON.stringify(line));
    });
    next();
}
