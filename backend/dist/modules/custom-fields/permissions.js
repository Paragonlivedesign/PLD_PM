import { singleError } from "../../http/envelope.js";
const PERM_MANAGE = "custom_fields.definitions.manage";
export function requireDefinitionsManage(req, res, next) {
    if (process.env.PLD_REQUIRE_PERMISSIONS === "false") {
        next();
        return;
    }
    const raw = req.headers["x-permissions"] ?? req.headers["x-permission"];
    const list = typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : [];
    if (list.includes(PERM_MANAGE)) {
        next();
        return;
    }
    const { body, status } = singleError("forbidden", "Requires custom_fields.definitions.manage permission", 403);
    res.status(status).json(body);
}
