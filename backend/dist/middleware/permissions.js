import { singleError } from "../http/envelope.js";
/** Dev: header X-Permissions: * or comma list e.g. trucks:create,scheduling:create */
export function hasPermission(req, perm) {
    const raw = req.header("X-Permissions")?.trim();
    if (!raw || raw === "*")
        return true;
    const set = new Set(raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean));
    return set.has("*") || set.has(perm);
}
export function requirePermission(perm) {
    return (req, res, next) => {
        if (!hasPermission(req, perm)) {
            const { body, status } = singleError("forbidden", `Missing permission: ${perm}`, 403);
            res.status(status).json(body);
            return;
        }
        next();
    };
}
