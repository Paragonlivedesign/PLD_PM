import { HttpError } from "../../core/http-error.js";
const EMPLOYMENT = ["full_time", "part_time", "freelance", "contractor"];
const STATUS = ["active", "inactive", "on_leave"];
export function assertEmail(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, "VALIDATION", "Invalid email", "email");
    }
}
export function assertEmploymentType(v) {
    if (!EMPLOYMENT.includes(v)) {
        throw new HttpError(400, "VALIDATION", "Invalid employment_type", "employment_type");
    }
}
export function assertPersonnelStatus(v) {
    if (!STATUS.includes(v)) {
        throw new HttpError(400, "VALIDATION", "Invalid status", "status");
    }
}
export function parseOptionalStatus(s) {
    if (s === undefined)
        return undefined;
    assertPersonnelStatus(s);
    return s;
}
export function clampLimit(raw, fallback, max = 100) {
    const n = raw === undefined ? fallback : Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1)
        return fallback;
    return Math.min(n, max);
}
export function parseCsvEnums(raw, allowed) {
    if (!raw || raw.trim() === "")
        return undefined;
    const parts = raw.split(",").map((s) => s.trim());
    for (const p of parts) {
        if (!allowed.includes(p)) {
            throw new HttpError(400, "VALIDATION", `Invalid filter value: ${p}`);
        }
    }
    return parts;
}
