export function normalizeEmail(s) {
    if (s == null || typeof s !== "string")
        return null;
    const t = s.trim();
    if (!t)
        return null;
    return t.toLowerCase();
}
/** Build emails/phones JSONB from legacy single fields. */
export function emailsFromSingle(email) {
    const n = normalizeEmail(email);
    if (!n)
        return [];
    const raw = String(email).trim();
    return [{ address: raw, normalized: n, is_primary: true }];
}
export function phonesFromSingle(phone) {
    if (phone == null || String(phone).trim() === "")
        return [];
    const raw = String(phone).trim();
    return [{ address: raw, e164: null, is_primary: true }];
}
export function parseEmailsJson(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const x of raw) {
        if (!x || typeof x !== "object")
            continue;
        const o = x;
        const address = typeof o.address === "string" ? o.address : "";
        const normalized = typeof o.normalized === "string" ? o.normalized : normalizeEmail(address) || "";
        if (!address && !normalized)
            continue;
        out.push({
            address: address || normalized,
            normalized: normalized || normalizeEmail(address) || "",
            is_primary: Boolean(o.is_primary),
            ...(typeof o.label === "string" ? { label: o.label } : {}),
        });
    }
    return out;
}
export function parsePhonesJson(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const x of raw) {
        if (!x || typeof x !== "object")
            continue;
        const o = x;
        const address = typeof o.address === "string" ? o.address : "";
        if (!address)
            continue;
        out.push({
            address,
            e164: typeof o.e164 === "string" ? o.e164 : null,
            is_primary: Boolean(o.is_primary),
            ...(typeof o.label === "string" ? { label: o.label } : {}),
        });
    }
    return out;
}
export function primaryEmailNormalizedFromEmails(emails) {
    const primary = emails.find((e) => e.is_primary) ?? emails[0];
    if (!primary)
        return null;
    return normalizeEmail(primary.normalized || primary.address);
}
